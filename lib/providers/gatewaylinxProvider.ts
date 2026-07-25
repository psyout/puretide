import crypto from 'crypto';
import type { CreatePaymentSessionResult, PaymentProvider, PaymentResult } from '../paymentProvider';
import { getGatewaylinxConfig } from '../env';

// Map common country names to ISO alpha-2 codes for Gatewaylinx.
function isoCountryCode(country: string): string {
	const map: Record<string, string> = {
		canada: 'CA',
		'united states': 'US',
		'united states of america': 'US',
		usa: 'US',
		mexico: 'MX',
	};
	const normalized = country.trim().toLowerCase();
	return map[normalized] || country.toUpperCase().slice(0, 2);
}

// Map common province/state names to ISO codes. Currently supports Canada provinces.
function isoStateCode(province: string, countryIso: string): string {
	if (countryIso !== 'CA') return province.slice(0, 2).toUpperCase();
	const map: Record<string, string> = {
		alberta: 'AB',
		'british columbia': 'BC',
		manitoba: 'MB',
		'new brunswick': 'NB',
		'newfoundland and labrador': 'NL',
		newfoundland: 'NL',
		'nova scotia': 'NS',
		ontario: 'ON',
		'prince edward island': 'PE',
		quebec: 'QC',
		saskatchewan: 'SK',
		'northwest territories': 'NT',
		nunavut: 'NU',
		yukon: 'YT',
	};
	const normalized = province.trim().toLowerCase();
	return map[normalized] || province.slice(0, 2).toUpperCase();
}

interface GatewaylinxInitResponse {
	success: boolean;
	iframe_url?: string;
	redirect_url?: string;
	capture_url?: string;
	capture_secret?: string;
	unique_id?: string;
	error?: string;
}

interface GatewaylinxChargeResponse {
	success: boolean;
	indeterminate?: boolean;
	order_id?: string; // gateway transaction ID (approved)
	redirect?: boolean; // true when 3DS is required
	redirectUrl?: string; // 3DS redirect URL
	error?: string;
}

interface GatewaylinxPostbackPayload {
	status: string;
	status_post: string;
	transaction_id: string;
	transid: string;
	session: string; // order_id
	amount: string;
	site_id: string;
	hmac?: string;
}

export class GatewaylinxProvider implements PaymentProvider {
	private config = getGatewaylinxConfig();

	async createPaymentSession(payload: unknown): Promise<CreatePaymentSessionResult> {
		if (!this.config) {
			throw new Error('Gatewaylinx not configured');
		}

		// Extract order details from payload
		// Expected payload: { orderNumber: string, amount: number, returnUrl: string, postbackUrl: string, customer: {...} }
		const orderPayload = payload as {
			orderNumber: string;
			amount: number;
			returnUrl: string;
			postbackUrl: string;
			customerIp?: string;
			customer: {
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

		const timestamp = Math.floor(Date.now() / 1000);

		// HMAC signing for init request: site_id|order_id|timestamp
		const signedFields = [this.config.siteId, orderPayload.orderNumber, timestamp.toString()];
		const hmac = this.computeHmac(signedFields);

		// Build init request with customer information
		// Country/state must be ISO alpha-2 codes (CA, BC) — full names cause bank-side declines.
		const countryIso = isoCountryCode(orderPayload.customer.country);
		const stateIso = isoStateCode(orderPayload.customer.province, countryIso);

		const initParams = new URLSearchParams({
			action: 'init',
			site_id: this.config.siteId,
			order_id: orderPayload.orderNumber,
			amount: orderPayload.amount.toFixed(2), // Decimal, store currency (not cents)
			timestamp: timestamp.toString(),
			hmac,
			pburl: orderPayload.postbackUrl,
			tcomplete: orderPayload.returnUrl, // Gatewaylinx uses 'tcomplete', not 'return_url'
			mode: 'inline', // Use inline mode for checkout page
			woocomerce: '1', // Required field (spelled without second 'm')
			// Customer information (may be required for 3DS)
			first_name: orderPayload.customer.firstName,
			last_name: orderPayload.customer.lastName,
			email: orderPayload.customer.email,
			address: orderPayload.customer.address,
			city: orderPayload.customer.city,
			state: stateIso,
			zip: orderPayload.customer.zipCode.replace(/\s+/g, ''), // API requires no spaces in postal code
			country: countryIso,
			order_description: `Order #${orderPayload.orderNumber}`,
			shipped: '1', // Physical goods
			...(orderPayload.customerIp ? { customer_ip: orderPayload.customerIp } : {}),
		});

		console.log(
			'Gatewaylinx init params:',
			JSON.stringify({
				tcomplete: initParams.get('tcomplete'),
				pburl: initParams.get('pburl'),
				country: initParams.get('country'),
				state: initParams.get('state'),
				customer_ip: initParams.get('customer_ip'),
				order_id: initParams.get('order_id'),
				amount: initParams.get('amount'),
			}),
		);

		const response = await fetch(`${this.config.relayUrl}/checkout_api.php?action=init`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: initParams.toString(),
		});

		const result = (await response.json()) as GatewaylinxInitResponse;

		console.log('Gatewaylinx init response:', JSON.stringify(result));

		if (!result.success) {
			throw new Error(`Gatewaylinx init failed: ${result.error || 'Unknown error'}`);
		}

		// API reference shows 'iframe_url' for payment_page mode, not 'redirect_url'
		const redirectUrl = result.redirect_url || result.iframe_url;
		if (!redirectUrl) {
			throw new Error(`Gatewaylinx init failed: No redirect URL in response`);
		}

		return {
			redirectUrl,
			orderNumber: orderPayload.orderNumber,
		};
	}

	// amount is sourced from the DB server-side — never accepted from the client
	async chargePayment(orderNumber: string, amount: number, token: string, reference: string): Promise<GatewaylinxChargeResponse> {
		if (!this.config) {
			throw new Error('Gatewaylinx not configured');
		}

		const timestamp = Math.floor(Date.now() / 1000);

		// HMAC signing for charge request: site_id|amount|order_id|token|timestamp
		const signedFields = [this.config.siteId, amount.toFixed(2), orderNumber, token, timestamp.toString()];
		const hmac = this.computeHmac(signedFields);

		const chargeParams = new URLSearchParams({
			action: 'charge',
			site_id: this.config.siteId,
			order_id: orderNumber,
			amount: amount.toFixed(2),
			timestamp: timestamp.toString(),
			hmac,
			token,
			reference,
			woocomerce: '1',
		});

		const response = await fetch(`${this.config.relayUrl}/checkout_api.php?action=charge`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: chargeParams.toString(),
		});

		const result = (await response.json()) as GatewaylinxChargeResponse;

		console.log('Gatewaylinx charge response:', JSON.stringify(result));

		return result;
	}

	async validatePaymentNotification(request: Request): Promise<PaymentResult> {
		if (!this.config) {
			throw new Error('Gatewaylinx not configured');
		}

		const rawBody = await request.text();

		// Postbacks are documented as JSON, but some interim 3DS postbacks arrive form-encoded.
		// Try JSON first; fall back to URLSearchParams so neither format causes a hard crash.
		let body: GatewaylinxPostbackPayload;
		try {
			body = JSON.parse(rawBody) as GatewaylinxPostbackPayload;
		} catch {
			const params = new URLSearchParams(rawBody);
			body = {
				status: params.get('status') ?? '',
				status_post: params.get('status_post') ?? '',
				transaction_id: params.get('transaction_id') ?? params.get('transid') ?? '',
				transid: params.get('transid') ?? params.get('transaction_id') ?? '',
				session: params.get('session') ?? '',
				amount: params.get('amount') ?? '',
				site_id: params.get('site_id') ?? '',
				...(params.get('hmac') ? { hmac: params.get('hmac')! } : {}),
			};
			console.warn('Gatewaylinx postback arrived form-encoded (not JSON) — parsed via URLSearchParams');
		}

		const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';

		// 1. IP whitelist verification (optional per docs, but enforced for production)
		// Disabled for sandbox testing (dryRunFulfillment=true) - enable for production
		if (!this.config.dryRunFulfillment && this.config.allowedIps.length > 0 && !this.config.allowedIps.includes(clientIp)) {
			console.error(`Gatewaylinx postback from unauthorized IP: ${clientIp}`);
			return { ok: false, orderNumber: body.session };
		}

		// 2. HMAC verification
		if (body.hmac) {
			const hmacResult = this.verifyPostbackHmac(body, body.hmac);
			if (!hmacResult.ok) {
				console.error(`Gatewaylinx postback HMAC verification failed: ${hmacResult.message}`);
				return { ok: false, orderNumber: body.session };
			}
		}

		// 3. Site ID verification
		if (body.site_id !== this.config.siteId) {
			console.error(`Gatewaylinx postback site_id mismatch: ${body.site_id} vs ${this.config.siteId}`);
			return { ok: false, orderNumber: body.session };
		}

		// 4. Status verification — status_post is the authoritative field per API docs.
		// status is always 'approved'; status_post distinguishes final approval from interim (e.g. 3ds_required).
		if (body.status_post !== 'approved') {
			console.log(`Gatewaylinx postback not approved: status=${body.status}, status_post=${body.status_post}`);
			// Return HTTP 200 but don't mark as paid (interim status like 3ds_required)
			return { ok: true, orderNumber: body.session, rawStatus: body.status_post };
		}

		// 5. Amount validation (will be done by caller with order data)
		// 6. Transaction ID deduplication (will be done by caller)
		// 7. Idempotency guard (will be done by caller)

		return {
			ok: true,
			orderNumber: body.session,
			amountReceived: parseFloat(body.amount),
			transactionId: body.transaction_id || body.transid,
			rawStatus: body.status_post,
		};
	}

	private computeHmac(signedFields: string[]): string {
		if (!this.config) {
			throw new Error('Gatewaylinx not configured');
		}
		const signedString = signedFields.join('|');
		return crypto.createHmac('sha256', this.config.hmacKey).update(signedString).digest('hex');
	}

	// Accepts the already-parsed body object so it works for both JSON and form-encoded postbacks.
	// The HMAC canonical string is built from field values, not the raw body text.
	private verifyPostbackHmac(body: GatewaylinxPostbackPayload, providedHmac: string): { ok: true } | { ok: false; message: string } {
		if (!this.config) {
			return { ok: false, message: 'Gatewaylinx not configured' };
		}

		try {
			// Canonical string: site_id | session | amount | status | status_post | transaction_id
			const canonicalString = [body.site_id, body.session, body.amount, body.status, body.status_post, body.transaction_id || body.transid].join('|');

			const expectedHmac = crypto.createHmac('sha256', this.config.hmacKey).update(canonicalString).digest('hex');

			if (providedHmac.length !== expectedHmac.length) {
				return { ok: false, message: 'HMAC length mismatch' };
			}

			if (crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac))) {
				return { ok: true };
			}

			return { ok: false, message: 'HMAC verification failed' };
		} catch {
			return { ok: false, message: 'HMAC verification error' };
		}
	}
}
