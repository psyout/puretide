const API_BASE_URL = 'https://api.gatewaylinx.com';
const PAYMENT_ID_PATTERN = /^pay_[0-9a-f]{32}$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

export type CardPayment = {
	id: string;
	reference: string;
	status: string;
	outcome: string;
	final: boolean;
	poll_after_seconds: number | null;
	amount: { amount_minor: number; currency: string };
	amount_matches: boolean | null;
	next_action: { type: string; url?: string } | null;
	checkout_url?: string;
	expires_at: string | null;
	attempts?: Array<{
		cardholder_message?: { headline?: string; guidance?: string } | null;
	}>;
};

export type CardPaymentsConnection = {
	environment: 'test' | 'live';
	api_version: string;
	merchant_id: string;
	site_id: string;
	limits: Array<{ currency: string; max_amount_minor: number }>;
	shipping?: { required: boolean };
};

export type HostedPaymentInput = {
	reference: string;
	amountMinor: number;
	currency: 'CAD';
	merchant_redirect_url: string;
	customer: {
		first_name: string;
		last_name: string;
		email: string;
		phone: string;
		ip_address: string;
		billing_address: {
			line1: string;
			city: string;
			state: string;
			postal_code: string;
			country: string;
		};
	};
	shipping?: {
		first_name: string;
		last_name: string;
		phone?: string;
		address: {
			line1: string;
			line2?: string;
			city: string;
			state?: string;
			postal_code?: string;
			country: string;
		};
	};
};

export class CardPaymentsApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code?: string,
		readonly requestId?: string,
		readonly retryable?: boolean,
		readonly retryAfterSeconds?: number,
	) {
		super(message);
		this.name = 'CardPaymentsApiError';
	}
}

function apiKey(): string {
	const key = process.env.CARD_PAYMENTS_KEY?.trim();
	if (!key) throw new Error('CARD_PAYMENTS_KEY is not configured');
	return key;
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
	const response = await fetch(`${API_BASE_URL}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${apiKey()}`,
			Accept: 'application/json',
			...(init.body ? { 'Content-Type': 'application/json' } : {}),
			...init.headers,
		},
		signal: init.signal ?? AbortSignal.timeout(30_000),
		cache: 'no-store',
	});
	const raw = await response.text();
	let body: Record<string, unknown>;
	try {
		body = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		throw new CardPaymentsApiError('Card Payments returned a non-JSON response', response.status);
	}
	if (!response.ok) {
		const error = (body.error ?? {}) as Record<string, unknown>;
		const retryAfterRaw = response.headers.get('retry-after');
		const retryAfter = retryAfterRaw ? Number(retryAfterRaw) : NaN;
		throw new CardPaymentsApiError(
			`Card Payments request failed: ${String(error.code ?? 'unknown')}`,
			response.status,
			typeof error.code === 'string' ? error.code : undefined,
			typeof error.request_id === 'string' ? error.request_id : undefined,
			error.retryable === true,
			Number.isFinite(retryAfter) ? retryAfter : undefined,
		);
	}
	return body as T;
}

export async function getCardPaymentsConnection(): Promise<CardPaymentsConnection> {
	return apiRequest<CardPaymentsConnection>('/v1/connection');
}

export async function createHostedCardPayment(input: HostedPaymentInput): Promise<CardPayment> {
	if (!REFERENCE_PATTERN.test(input.reference)) throw new Error('Invalid payment reference');
	if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Invalid payment amount');
	const payment = await apiRequest<CardPayment>('/v1/payments', {
		method: 'POST',
		body: JSON.stringify({ surface: 'gateway_hosted', ...input }),
	});
	if (!PAYMENT_ID_PATTERN.test(payment.id) || payment.reference !== input.reference) {
		throw new Error('Card Payments returned a payment for the wrong order');
	}
	if (payment.amount?.amount_minor !== input.amountMinor || payment.amount?.currency !== input.currency) {
		throw new Error('Card Payments returned an unexpected amount');
	}
	const checkoutUrl = payment.checkout_url ? new URL(payment.checkout_url) : null;
	if (!checkoutUrl || checkoutUrl.origin !== API_BASE_URL || !checkoutUrl.pathname.startsWith('/checkout/') || checkoutUrl.username || checkoutUrl.password) {
		throw new Error('Card Payments returned an invalid checkout URL');
	}
	return payment;
}

export async function getCardPaymentById(id: string): Promise<CardPayment> {
	if (!PAYMENT_ID_PATTERN.test(id)) throw new Error('Invalid payment ID');
	return apiRequest<CardPayment>(`/v1/payments/${id}`, { signal: AbortSignal.timeout(10_000) });
}

export async function getCardPaymentByReference(reference: string): Promise<CardPayment> {
	if (!REFERENCE_PATTERN.test(reference)) throw new Error('Invalid payment reference');
	return apiRequest<CardPayment>(`/v1/payments/by-reference/${encodeURIComponent(reference)}`, { signal: AbortSignal.timeout(10_000) });
}

/** Read the saved payment even after a decline frees its reference. */
export async function getCurrentCardPayment(reference: string, savedId?: string): Promise<CardPayment> {
	const payment = savedId ? await getCardPaymentById(savedId) : await getCardPaymentByReference(reference);
	if (payment.status !== 'canceled') return payment;
	try {
		return await getCardPaymentByReference(reference);
	} catch (error) {
		if (error instanceof CardPaymentsApiError && error.status === 404) return payment;
		throw error;
	}
}
