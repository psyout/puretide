import crypto from 'crypto';
import type { CreatePaymentSessionResult, PaymentProvider, PaymentResult } from '../paymentProvider';
import { buildDigipayPaymentUrl, type DigipayPaymentParams } from '../digipay';
import { getDigipayConfig } from '../env';

interface DigipayPostbackPayload {
	session: string;
	amount: string | number;
	status?: string;
	result?: string;
}

export class DigipayProvider implements PaymentProvider {
	private config = getDigipayConfig();

	async createPaymentSession(payload: unknown): Promise<CreatePaymentSessionResult> {
		if (!this.config) {
			throw new Error('DigiPay not configured');
		}

		// Extract order details from payload
		// Expected payload: { orderNumber: string, amount: number, returnUrl: string, postbackUrl: string, customer: {...} }
		const orderPayload = payload as {
			orderNumber: string;
			amount: number;
			returnUrl: string;
			postbackUrl: string;
			customer?: {
				firstName: string;
				lastName: string;
				email: string;
				address: string;
				city: string;
				province: string;
				zipCode: string;
				country: string;
			};
		};

		if (!orderPayload.orderNumber || !orderPayload.amount) {
			throw new Error('Invalid order payload: missing orderNumber or amount');
		}

		const encryptionKey = process.env.DIGIPAY_ENCRYPTION_KEY;
		if (!encryptionKey) {
			throw new Error('DIGIPAY_ENCRYPTION_KEY not configured');
		}

		const params: DigipayPaymentParams = {
			siteId: this.config.siteId,
			chargeAmount: orderPayload.amount,
			orderDescription: `Order #${orderPayload.orderNumber}`,
			session: orderPayload.orderNumber,
			pburl: orderPayload.postbackUrl,
			tcomplete: orderPayload.returnUrl,
			shipped: true,
		};

		if (orderPayload.customer) {
			params.firstName = orderPayload.customer.firstName;
			params.lastName = orderPayload.customer.lastName;
			params.email = orderPayload.customer.email;
			params.address = orderPayload.customer.address;
			params.city = orderPayload.customer.city;
			params.state = orderPayload.customer.province;
			params.zip = orderPayload.customer.zipCode;
			params.country = orderPayload.customer.country;
		}

		const redirectUrl = buildDigipayPaymentUrl(params, encryptionKey);

		return {
			redirectUrl,
			orderNumber: orderPayload.orderNumber,
		};
	}

	async validatePaymentNotification(request: Request): Promise<PaymentResult> {
		if (!this.config) {
			throw new Error('DigiPay not configured');
		}

		// IP whitelist verification
		const clientIp = this.extractClientIp(request);
		if (!clientIp || !this.config.allowedIps.includes(clientIp)) {
			console.error(`DigiPay postback from unauthorized IP: ${clientIp}`);
			return { ok: false, orderNumber: '' };
		}

		const rawBody = await request.text();

		// HMAC verification
		const hmacResult = this.verifyHmacSignature(rawBody, request);
		if (!hmacResult.ok) {
			console.error(`DigiPay postback HMAC verification failed: ${hmacResult.message}`);
			return { ok: false, orderNumber: '' };
		}

		// Parse postback body
		const data = this.parsePostbackBody(rawBody);
		const session = typeof data.session === 'string' ? data.session.trim() : '';

		if (!session) {
			console.error('DigiPay postback missing session');
			return { ok: false, orderNumber: '' };
		}

		// Extract amount
		const amountVal = data.amount;
		const rawAmount = typeof amountVal === 'number' ? String(amountVal) : typeof amountVal === 'string' ? amountVal.trim() : '';
		const paidAmount = Number(rawAmount.replace('_', '.'));

		// Extract status
		const statusRaw = typeof data.status === 'string' ? data.status.trim().toLowerCase() : typeof data.result === 'string' ? data.result.trim().toLowerCase() : '';
		const approvedStatuses = ['approved', 'success', 'completed'];
		const isApproved = !statusRaw || approvedStatuses.includes(statusRaw);

		return {
			ok: true,
			orderNumber: session,
			amountReceived: Number.isNaN(paidAmount) ? undefined : paidAmount,
			rawStatus: statusRaw || (isApproved ? 'approved' : 'unknown'),
		};
	}

	private extractClientIp(request: Request): string {
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

	private verifyHmacSignature(rawBody: string, request: Request): { ok: true } | { ok: false; message: string } {
		const secret = this.config?.hmacSecret;
		const provided = request.headers.get('x-digipay-signature') ?? request.headers.get('x-signature') ?? request.headers.get('digipay-signature') ?? '';

		if (!secret) {
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

	private parsePostbackBody(rawBody: string): Record<string, unknown> {
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
}
