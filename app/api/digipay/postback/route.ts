import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getOrderBySessionFromDb, upsertOrderInDb } from '@/lib/ordersDb';
import { runFulfillment, type FulfillmentOrder } from '@/lib/orderFulfillment';
import { createRetryJobForOrder } from '@/lib/retryJobs';
import { validateOrderStateTransition, type OrderPaymentStatus } from '@/lib/orderComputation';
import { getPaymentProvider } from '@/lib/paymentProvider';
import { getGatewaylinxConfig } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
	const normalize = (value: string) => value.split(':')[0].trim();
	const isLoopback = (ip: string) => ip === '127.0.0.1' || ip === '::1';

	const cf = request.headers.get('cf-connecting-ip');
	if (cf) return normalize(cf);

	const trueClientIp = request.headers.get('true-client-ip');
	if (trueClientIp) return normalize(trueClientIp);

	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		const parts = forwarded
			.split(',')
			.map((p) => normalize(p))
			.filter(Boolean);
		const firstNonLoopback = parts.find((p) => !isLoopback(p));
		return firstNonLoopback ?? parts[0] ?? '';
	}

	const realIp = request.headers.get('x-real-ip');
	if (realIp) return normalize(realIp);

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
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
			Pragma: 'no-cache',
			Expires: '0',
		},
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

	// DigiPay may send a JSON string in the POST key (documented format)
	for (const [key] of Array.from(params.entries())) {
		const trimmedKey = key.trim();
		if (!trimmedKey.startsWith('{')) continue;
		try {
			return JSON.parse(trimmedKey) as Record<string, unknown>;
		} catch {
			// try next
		}
	}

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
	const isProduction = process.env.NODE_ENV === 'production';
	const provided = request.headers.get('x-digipay-signature') ?? request.headers.get('x-signature') ?? request.headers.get('digipay-signature') ?? '';

	if (!secret) {
		if (!hasWarnedMissingHmacSecret) {
			console.warn(
				isProduction
					? 'DIGIPAY_POSTBACK_HMAC_SECRET not configured in production. Skipping HMAC verification (IP allowlist still enforced).'
					: 'DIGIPAY_POSTBACK_HMAC_SECRET not configured. Skipping HMAC verification in development.',
			);
			hasWarnedMissingHmacSecret = true;
		}

		// If DigiPay isn't configured to send signatures, we accept based on IP allowlist alone.
		// However, if a signature header IS provided, reject to avoid accepting spoofed signed requests.
		if (provided) return { ok: false, message: 'HMAC secret not configured but signature header was provided' };

		return { ok: true };
	}

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
		// Use provider abstraction to validate the postback
		const provider = getPaymentProvider();
		const gatewaylinxConfig = getGatewaylinxConfig();
		const isGatewaylinx = !!gatewaylinxConfig;

		const result = await provider.validatePaymentNotification(request);

		if (!result.ok) {
			console.warn(JSON.stringify({ label: 'digipay:postback:validation_failed', orderNumber: result.orderNumber }));
			return xmlResponse('fail', 102, 'Validation failed');
		}

		// Load order
		const order = await getOrderBySessionFromDb(result.orderNumber);
		if (!order) {
			console.warn(JSON.stringify({ label: 'digipay:postback:unknown_order', orderNumber: result.orderNumber }));
			return xmlResponse('fail', 102, 'Unknown order');
		}

		// Check if order already paid (idempotency)
		if (order.paymentStatus === 'paid') {
			console.log(JSON.stringify({ label: 'digipay:postback:already_paid', orderNumber: result.orderNumber }));
			return xmlResponse('ok', 100, 'Order already processed', result.orderNumber);
		}

		// For interim statuses (e.g., 3ds_required), return 200 but don't mark as paid
		if (result.rawStatus && result.rawStatus !== 'approved') {
			console.log(JSON.stringify({ label: 'digipay:postback:interim_status', orderNumber: result.orderNumber, status: result.rawStatus }));
			return xmlResponse('ok', 100, 'Interim status acknowledged');
		}

		// Amount validation
		if (result.amountReceived !== undefined) {
			const expectedAmount = Number(order.total ?? 0);
			if (Math.abs(result.amountReceived - expectedAmount) > 0.01) {
				console.warn(
					JSON.stringify({
						label: 'digipay:postback:amount_mismatch',
						orderNumber: result.orderNumber,
						expectedAmount,
						receivedAmount: result.amountReceived,
					}),
				);
				if (!validateOrderStateTransition(order.paymentStatus as OrderPaymentStatus, 'failed')) {
					return xmlResponse('ok', 100, 'Order already processed');
				}
				await upsertOrderInDb({
					...order,
					paymentStatus: 'failed',
					paymentFailure: {
						reason: 'amount_mismatch',
						expectedAmount,
						receivedAmount: result.amountReceived,
						updatedAt: new Date().toISOString(),
					},
				} as Record<string, unknown>);
				return xmlResponse('fail', 104, 'Amount mismatch');
			}
		}

		console.log(JSON.stringify({ label: 'digipay:postback:approved', orderNumber: result.orderNumber, amountReceived: result.amountReceived }));

		const paidAt = new Date().toISOString();

		// Gatewaylinx dry-run fulfillment mode
		if (isGatewaylinx && gatewaylinxConfig.dryRunFulfillment) {
			console.log(JSON.stringify({ label: 'digipay:postback:dry_run', orderNumber: result.orderNumber }));

			// Store additive dry-run audit marker in order_json
			const existingOrderJson = ((order as Record<string, unknown>).order_json as Record<string, unknown>) || {};
			const gatewaylinxAudit = {
				dryRunApprovedAt: paidAt,
				transactionId: result.transactionId,
				amountReceived: result.amountReceived,
				status: result.rawStatus || 'approved',
			};

			await upsertOrderInDb({
				...order,
				order_json: {
					...existingOrderJson,
					gatewaylinx: gatewaylinxAudit,
				},
			} as Record<string, unknown>);

			console.log(JSON.stringify({ label: 'digipay:postback:dry_run_audit_stored', orderNumber: result.orderNumber, audit: gatewaylinxAudit }));

			// Keep paymentStatus: "pending" - do not trigger fulfillment
			// Do not decrement stock, create Wrike tasks, or send emails
			return xmlResponse('ok', 100, 'Dry-run: audit stored, fulfillment skipped');
		}

		// Production mode: run full fulfillment
		let emailStatus: { sent: boolean; skipped: boolean; error?: string };
		let adminEmailStatus: { sent: boolean; skipped: boolean; error?: string };
		let fulfillmentFailed = false;
		try {
			const fulfillmentResult = await runFulfillment(order as FulfillmentOrder);
			emailStatus = fulfillmentResult.emailStatus;
			adminEmailStatus = fulfillmentResult.adminEmailStatus;
		} catch (fulfillError) {
			console.error(JSON.stringify({ label: 'digipay:postback:fulfillment_failed', orderNumber: result.orderNumber }));
			console.error(fulfillError);
			fulfillmentFailed = true;
			// Create retry job for later fulfillment
			try {
				await createRetryJobForOrder(result.orderNumber);
				console.log(`[digipay:postback] Created retry job for order ${result.orderNumber}`);
			} catch (retryError) {
				console.error(`[digipay:postback] Failed to create retry job for order ${result.orderNumber}`, retryError);
			}
			// Set default email status for failed fulfillment
			emailStatus = { sent: false, skipped: false, error: 'Fulfillment failed' };
			adminEmailStatus = { sent: false, skipped: false, error: 'Fulfillment failed' };
		}

		if (!emailStatus.sent) {
			console.warn(`[digipay:postback] Order ${result.orderNumber} customer email not sent: ${emailStatus.skipped ? 'SMTP not configured' : (emailStatus.error ?? 'unknown')}`);
		}
		if (!adminEmailStatus.sent) {
			console.warn(`[digipay:postback] Order ${result.orderNumber} admin email not sent: ${adminEmailStatus.skipped ? 'SMTP not configured' : (adminEmailStatus.error ?? 'unknown')}`);
		}

		// Validate state transition before marking as paid
		if (!validateOrderStateTransition(order.paymentStatus as OrderPaymentStatus, 'paid')) {
			console.warn(JSON.stringify({ label: 'digipay:postback:invalid_transition', orderNumber: result.orderNumber, from: order.paymentStatus, to: 'paid' }));
			return xmlResponse('ok', 100, 'Order already processed');
		}

		await upsertOrderInDb({
			...order,
			paymentStatus: 'paid',
			paidAt,
			fulfillmentStatus: fulfillmentFailed
				? {
						stockUpdated: false,
						emailsSent: false,
						clientSynced: false,
						failedAt: paidAt,
					}
				: {
						stockUpdated: true,
						emailsSent: Boolean(emailStatus?.sent && adminEmailStatus?.sent),
						clientSynced: (order.fulfillmentStatus as { clientSynced?: boolean } | undefined)?.clientSynced ?? false,
					},
			emailStatus,
			adminEmailStatus,
		} as Record<string, unknown>);

		console.log(JSON.stringify({ label: 'digipay:postback:marked_paid', orderNumber: result.orderNumber }));

		return xmlResponse('ok', 100, 'Purchase successfully processed', result.orderNumber);
	} catch (error) {
		console.error(JSON.stringify({ label: 'digipay:postback:unhandled_error' }));
		console.error(error);
		return xmlResponse('fail', 104, 'Unable to process purchase');
	}
}
