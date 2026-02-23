import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getOrderBySessionFromDb, upsertOrderInDb } from '@/lib/ordersDb';
import { runFulfillment, type FulfillmentOrder } from '@/lib/orderFulfillment';

const DIGIPAY_ALLOWED_IP_DEFAULT = '185.240.29.227';
let hasWarnedMissingHmacSecret = false;

/* ----------------------------- Helpers ----------------------------- */

function getAllowedIps(): string[] {
	const env = process.env.DIGIPAY_POSTBACK_ALLOWED_IP;
	if (env)
		return env
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	return [DIGIPAY_ALLOWED_IP_DEFAULT];
}

function extractClientIp(request: Request): string {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) return forwarded.split(',')[0].trim();

	const realIp = request.headers.get('x-real-ip');
	if (realIp) return realIp.trim();

	return '';
}

function xmlResponse(stat: 'ok' | 'fail', code: number, message: string, receipt?: string) {
	const body =
		stat === 'ok'
			? `<?xml version="1.0" encoding="UTF-8"?>\n<rsp stat="ok" version="1.0">\n<message id="${code}">${escapeXml(message)}</message>\n${
					receipt ? `<receipt>${escapeXml(receipt)}</receipt>\n` : ''
				}</rsp>`
			: `<?xml version="1.0" encoding="UTF-8"?>\n<rsp stat="fail" version="1.0">\n<error id="${code}">${escapeXml(message)}</error>\n</rsp>`;

	return new NextResponse(body, {
		status: 200,
		headers: { 'Content-Type': 'application/xml; charset=utf-8' },
	});
}

function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function parsePostbackBody(rawBody: string): Record<string, unknown> {
	if (rawBody.startsWith('{')) {
		try {
			return JSON.parse(rawBody);
		} catch {
			// fallback to form parsing
		}
	}

	const params = new URLSearchParams(rawBody);

	// DigiPay may send a JSON string in a form value
	for (const [, value] of Array.from(params.entries())) {
		if (!value.startsWith('{')) continue;
		try {
			return JSON.parse(value) as Record<string, unknown>;
		} catch {
			// try next
		}
	}

	// Flat form: session=xxx&amount=yyy&status=approved
	const flat: Record<string, unknown> = {};
	for (const [key, value] of Array.from(params.entries())) {
		flat[key] = value;
	}
	return flat;
}

function verifyHmacSignature(rawBody: string, request: Request): { ok: true } | { ok: false; message: string } {
	const secret = process.env.DIGIPAY_POSTBACK_HMAC_SECRET;

	if (!secret) {
		if (!hasWarnedMissingHmacSecret) {
			console.warn('DIGIPAY_POSTBACK_HMAC_SECRET not configured. Skipping HMAC verification.');
			hasWarnedMissingHmacSecret = true;
		}
		return { ok: true };
	}

	const provided = request.headers.get('x-digipay-signature') ?? request.headers.get('x-signature') ?? request.headers.get('digipay-signature') ?? '';

	if (!provided) return { ok: false, message: 'Missing signature header' };

	const normalized = provided.replace(/^sha256=/i, '').trim();

	const expectedHex = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

	const expectedBase64 = Buffer.from(expectedHex, 'hex').toString('base64');

	if (normalized.length === expectedHex.length && crypto.timingSafeEqual(Buffer.from(normalized), Buffer.from(expectedHex))) return { ok: true };

	if (normalized.length === expectedBase64.length && crypto.timingSafeEqual(Buffer.from(normalized), Buffer.from(expectedBase64))) return { ok: true };

	return { ok: false, message: 'Invalid signature' };
}

/* ----------------------------- POST ----------------------------- */

export async function POST(request: Request) {
	try {
		/* ---------- IP Validation ---------- */
		const clientIp = extractClientIp(request);
		const allowedIps = getAllowedIps();

		if (!clientIp || !allowedIps.includes(clientIp)) {
			console.warn(`[DigiPay postback] Rejected IP: ${clientIp || '(empty)'}`);
			return xmlResponse('fail', 101, `Request from unauthorized IP: ${clientIp || 'unknown'}`);
		}

		const rawBody = await request.text();

		/* ---------- HMAC ---------- */
		const hmac = verifyHmacSignature(rawBody, request);
		if (!hmac.ok) return xmlResponse('fail', 103, hmac.message);

		/* ---------- Parse ---------- */
		const data = parsePostbackBody(rawBody);
		if (Object.keys(data).length === 0) return xmlResponse('fail', 102, 'Invalid postback body');

		const session = typeof data.session === 'string' ? data.session.trim() : '';

		if (!session) return xmlResponse('fail', 102, "Invalid session variable: 'empty'");

		/* ---------- Payment Status Validation ---------- */
		const statusRaw = typeof data.status === 'string' ? data.status.trim().toLowerCase() : typeof data.result === 'string' ? data.result.trim().toLowerCase() : '';

		const approvedStatuses = ['approved', 'success', 'completed'];

		if (!approvedStatuses.includes(statusRaw)) {
			console.warn(`[DigiPay postback] Payment not approved. Status: ${statusRaw}`);
			return xmlResponse('fail', 105, 'Payment not approved');
		}

		/* ---------- Load Order ---------- */
		const order = await getOrderBySessionFromDb(session);

		if (!order) return xmlResponse('fail', 102, 'Invalid session variable');

		if (order.paymentStatus === 'paid') return xmlResponse('ok', 100, 'Order already processed', session);

		/* ---------- Amount Validation ---------- */
		const amountVal = data.amount;
		const rawAmount =
			typeof amountVal === 'number'
				? String(amountVal)
				: typeof amountVal === 'string'
					? amountVal.trim()
					: '';

		const paidAmount = Number(rawAmount.replace('_', '.'));
		const expectedAmount = Number(order.total ?? 0);

		if (!rawAmount || Number.isNaN(paidAmount)) return xmlResponse('fail', 102, 'Invalid amount format');

		if (Math.abs(paidAmount - expectedAmount) > 0.01) return xmlResponse('fail', 104, `Amount mismatch. Expected ${expectedAmount}, received ${paidAmount}`);

		const paidAt = new Date().toISOString();

		/* ---------- Run Fulfillment first; mark paid only after success ---------- */
		let emailStatus: { sent: boolean; skipped: boolean; error?: string };
		let adminEmailStatus: { sent: boolean; skipped: boolean; error?: string };
		try {
			const result = await runFulfillment(order as FulfillmentOrder);
			emailStatus = result.emailStatus;
			adminEmailStatus = result.adminEmailStatus;
		} catch (fulfillError) {
			console.error('[DigiPay postback] Fulfillment failed', fulfillError);
			return xmlResponse('fail', 104, 'Unable to process purchase');
		}

		if (!emailStatus.sent) {
			console.warn(`[DigiPay postback] Order ${session} customer email not sent: ${emailStatus.skipped ? 'SMTP not configured' : emailStatus.error ?? 'unknown'}`);
		}
		if (!adminEmailStatus.sent) {
			console.warn(`[DigiPay postback] Order ${session} admin email not sent: ${adminEmailStatus.skipped ? 'SMTP not configured' : adminEmailStatus.error ?? 'unknown'}`);
		}

		await upsertOrderInDb({
			...order,
			paymentStatus: 'paid',
			paidAt,
			fulfillmentStatus: {
				stockUpdated: true,
				emailsSent: true,
				clientSynced: (order.fulfillmentStatus as { clientSynced?: boolean } | undefined)?.clientSynced ?? false,
			},
			emailStatus,
			adminEmailStatus,
		} as Record<string, unknown>);

		console.log(`[DigiPay postback] Order ${session} marked paid and fulfilled`);

		return xmlResponse('ok', 100, 'Purchase successfully processed', session);
	} catch (error) {
		console.error('[DigiPay postback] Unhandled error', error);
		return xmlResponse('fail', 104, 'Unable to process purchase');
	}
}
