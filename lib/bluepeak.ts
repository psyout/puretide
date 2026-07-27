import crypto from 'crypto';

export type BluepeakCheckoutStatus = 'awaiting_payment' | 'partially_paid' | 'paid' | 'cancelled' | 'expired';

export type BluepeakCheckout = {
	checkout_id: string;
	status: BluepeakCheckoutStatus;
	amount: string;
	currency: 'CAD';
	reference: string;
	memo: string;
	deposit_email: string;
	recipient_name?: string;
	client_token: string;
	total_credited: string;
	overpaid: boolean;
	memo_mismatch?: boolean | null;
	expires_at?: string | null;
	created_at: string;
};

export class BluepeakApiError extends Error {
	status: number;
	body: string;

	constructor(message: string, status: number, body: string) {
		super(message);
		this.name = 'BluepeakApiError';
		this.status = status;
		this.body = body;
	}
}

export type BluepeakWebhookEvent = {
	event_id: string;
	event_type: 'payment.partial' | 'payment.completed' | 'checkout.expired' | 'payment.unmatched' | string;
	created_at: string;
	data: {
		checkout_id: string;
		reference: string;
		reference_number?: string;
		credit_amount?: string;
		total_credited: string;
		expected_amount: string;
		currency: 'CAD';
		status: BluepeakCheckoutStatus;
		overpaid: boolean;
		memo_mismatch?: boolean | null;
		sender_email?: string;
	};
};

function getBaseUrl(): string {
	const raw = String(process.env.BLUEPEAK_BASE_URL || 'https://deposit.bluepeakdns.com/v1')
		.trim()
		.replace(/\/$/, '');
	if (raw.endsWith('/v1')) return raw;
	return `${raw}/v1`;
}

function getSecretKey(): string {
	const key = process.env.BLUEPEAK_SECRET_KEY;
	if (!key) throw new Error('Missing BLUEPEAK_SECRET_KEY');
	return key;
}

export function toMoneyStringFromNumber(value: number): string {
	// BluePeak requires decimal strings; use two decimals.
	if (!Number.isFinite(value)) throw new Error('Invalid money value');
	return value.toFixed(2);
}

export function moneyStringToCents(value: string): number {
	// Strictly parse "123.45" -> 12345.
	const trimmed = String(value ?? '').trim();
	if (!/^[0-9]+\.[0-9]{2}$/.test(trimmed)) {
		throw new Error(`Invalid money string: ${trimmed}`);
	}
	const [dollars, cents] = trimmed.split('.');
	return Number(dollars) * 100 + Number(cents);
}

export function verifyBluepeakWebhookSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
	const providedRaw = (signatureHeader || '').trim();
	if (!providedRaw) return false;
	const provided = providedRaw.toLowerCase().startsWith('sha256=') ? providedRaw.slice('sha256='.length).trim() : providedRaw;
	if (!provided) return false;

	const key = String(secret ?? '').trim();
	const expectedBase64 = crypto.createHmac('sha256', key).update(rawBody, 'utf8').digest('base64');
	const expectedHex = crypto.createHmac('sha256', key).update(rawBody, 'utf8').digest('hex');

	if (provided.length === expectedBase64.length) {
		return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expectedBase64));
	}
	if (provided.length === expectedHex.length) {
		return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expectedHex));
	}
	return false;
}

export async function bluepeakCreateCheckout(input: {
	amount: string;
	reference: string;
	customer: { first_name: string; last_name: string; email: string };
	idempotencyKey: string;
}): Promise<BluepeakCheckout> {
	const url = `${getBaseUrl()}/checkouts`;
	const resp = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${getSecretKey()}`,
			'Content-Type': 'application/json',
			'Idempotency-Key': input.idempotencyKey,
		},
		body: JSON.stringify({
			amount: input.amount,
			currency: 'CAD',
			reference: input.reference,
			customer: input.customer,
		}),
	});
	if (!resp.ok) {
		const text = await resp.text();
		throw new BluepeakApiError('BluePeak create checkout failed', resp.status, text);
	}
	return (await resp.json()) as BluepeakCheckout;
}

export async function bluepeakGetCheckout(checkoutId: string): Promise<BluepeakCheckout> {
	const url = `${getBaseUrl()}/checkouts/${encodeURIComponent(checkoutId)}`;
	const resp = await fetch(url, {
		headers: {
			Authorization: `Bearer ${getSecretKey()}`,
		},
	});
	if (!resp.ok) {
		const text = await resp.text();
		throw new BluepeakApiError('BluePeak get checkout failed', resp.status, text);
	}
	return (await resp.json()) as BluepeakCheckout;
}

export async function bluepeakSimulateCredit(checkoutId: string, amount: string): Promise<BluepeakCheckout> {
	const url = `${getBaseUrl()}/test/checkouts/${encodeURIComponent(checkoutId)}/simulate_credit`;
	const resp = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${getSecretKey()}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ amount }),
	});
	if (!resp.ok) {
		const text = await resp.text();
		throw new BluepeakApiError('BluePeak simulate credit failed', resp.status, text);
	}
	return (await resp.json()) as BluepeakCheckout;
}
