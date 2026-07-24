import crypto from 'crypto';
import type { CreatePaymentSessionResult, PaymentProvider, PaymentResult } from '../paymentProvider';
import { getGatewaylinxConfig } from '../env';

interface GatewaylinxInitResponse {
	success: boolean;
	redirect_url?: string;
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
		const amountCents = Math.round(orderPayload.amount * 100); // Convert to cents

		// HMAC signing for init request: site_id|order_id|timestamp
		const signedFields = [this.config.siteId, orderPayload.orderNumber, timestamp.toString()];
		const hmac = this.computeHmac(signedFields);

		// Build init request with customer information
		const initParams = new URLSearchParams({
			action: 'init',
			site_id: this.config.siteId,
			order_id: orderPayload.orderNumber,
			amount: amountCents.toString(),
			timestamp: timestamp.toString(),
			hmac,
			pburl: orderPayload.postbackUrl,
			return_url: orderPayload.returnUrl,
			mode: 'payment_page', // Use hosted payment page mode
			// Customer information (may be required for 3DS)
			first_name: orderPayload.customer.firstName,
			last_name: orderPayload.customer.lastName,
			email: orderPayload.customer.email,
			address: orderPayload.customer.address,
			city: orderPayload.customer.city,
			state: orderPayload.customer.province,
			zip: orderPayload.customer.zipCode,
			country: orderPayload.customer.country,
			// Additional standard fields
			currency: 'CAD',
			description: `Order #${orderPayload.orderNumber}`,
		});

		const response = await fetch(`${this.config.relayUrl}/checkout_api.php?${initParams.toString()}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const result = (await response.json()) as GatewaylinxInitResponse;

		if (!result.success || !result.redirect_url) {
			throw new Error(`Gatewaylinx init failed: ${result.error || 'Unknown error'}`);
		}

		return {
			redirectUrl: result.redirect_url,
			orderNumber: orderPayload.orderNumber,
		};
	}

	async validatePaymentNotification(request: Request): Promise<PaymentResult> {
		if (!this.config) {
			throw new Error('Gatewaylinx not configured');
		}

		const rawBody = await request.text();
		const body = JSON.parse(rawBody) as GatewaylinxPostbackPayload;

		// 1. IP whitelist verification
		const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';

		if (!this.config.allowedIps.includes(clientIp)) {
			console.error(`Gatewaylinx postback from unauthorized IP: ${clientIp}`);
			return { ok: false, orderNumber: body.session };
		}

		// 2. HMAC verification (postbacks now include hmac field per Gatewaylinx)
		if (body.hmac) {
			const hmacResult = this.verifyPostbackHmac(rawBody, body.hmac);
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

		// 4. Status verification - only fulfill on approved
		if (body.status !== 'approved' && body.status_post !== 'approved') {
			console.log(`Gatewaylinx postback not approved: status=${body.status}, status_post=${body.status_post}`);
			// Return HTTP 200 but don't mark as paid (interim status like 3ds_required)
			return { ok: true, orderNumber: body.session, rawStatus: body.status };
		}

		// 5. Amount validation (will be done by caller with order data)
		// 6. Transaction ID deduplication (will be done by caller)
		// 7. Idempotency guard (will be done by caller)

		return {
			ok: true,
			orderNumber: body.session,
			amountReceived: parseFloat(body.amount),
			transactionId: body.transaction_id || body.transid,
			rawStatus: body.status,
		};
	}

	private computeHmac(signedFields: string[]): string {
		if (!this.config) {
			throw new Error('Gatewaylinx not configured');
		}
		const signedString = signedFields.join('|');
		return crypto.createHmac('sha256', this.config.hmacKey).update(signedString).digest('hex');
	}

	private verifyPostbackHmac(rawBody: string, providedHmac: string): { ok: true } | { ok: false; message: string } {
		if (!this.config) {
			return { ok: false, message: 'Gatewaylinx not configured' };
		}

		try {
			// Parse the body to extract and remove hmac field
			const bodyObj = JSON.parse(rawBody);
			const { hmac: _removed, ...bodyWithoutHmac } = bodyObj;

			// Re-encode remaining fields with sorted keys
			const sortedKeys = Object.keys(bodyWithoutHmac).sort();
			const sortedBody: Record<string, unknown> = {};
			for (const key of sortedKeys) {
				sortedBody[key] = bodyWithoutHmac[key];
			}
			const bodyString = JSON.stringify(sortedBody);

			// Compute expected HMAC
			const expectedHmac = crypto.createHmac('sha256', this.config.hmacKey).update(bodyString).digest('hex');

			// Constant-time comparison
			if (providedHmac.length !== expectedHmac.length) {
				return { ok: false, message: 'HMAC length mismatch' };
			}

			if (crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac))) {
				return { ok: true };
			}

			return { ok: false, message: 'HMAC verification failed' };
		} catch (error) {
			return { ok: false, message: 'HMAC verification error' };
		}
	}
}
