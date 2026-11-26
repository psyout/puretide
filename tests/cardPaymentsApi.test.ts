import test from 'node:test';
import assert from 'node:assert/strict';
import { CardPaymentsApiError, createHostedCardPayment, getCardPaymentById, getCurrentCardPayment } from '../lib/cardPaymentsApi';

const paymentId = `pay_${'a'.repeat(32)}`;
const input = {
	reference: 'ORDER-123',
	amountMinor: 2599,
	currency: 'CAD' as const,
	merchant_redirect_url: 'https://puretide.ca/order-confirmation?orderNumber=ORDER-123',
	customer: {
		first_name: 'Ada',
		last_name: 'Lovelace',
		email: 'ada@example.com',
		phone: '+15145550100',
		ip_address: '203.0.113.7',
		billing_address: { line1: '1 Main St', city: 'Montreal', state: 'QC', postal_code: 'H2X 1Y4', country: 'CA' },
	},
};

function payment(overrides: Record<string, unknown> = {}) {
	return {
		id: paymentId,
		reference: input.reference,
		status: 'pending_action',
		outcome: 'in_progress',
		final: false,
		poll_after_seconds: 10,
		amount: { amount_minor: input.amountMinor, currency: input.currency },
		amount_matches: null,
		next_action: null,
		checkout_url: `https://api.gatewaylinx.com/checkout/test-token`,
		expires_at: '2026-11-25T18:00:00Z',
		...overrides,
	};
}

test('hosted create sends only the server key and validates the returned order', async () => {
	const previousKey = process.env.CARD_PAYMENTS_KEY;
	const previousFetch = globalThis.fetch;
	process.env.CARD_PAYMENTS_KEY = 'fv_test_example';
	let request: { url: string; init: RequestInit } | undefined;
	globalThis.fetch = async (url, init) => {
		request = { url: String(url), init: init ?? {} };
		return Response.json(payment());
	};
	try {
		const created = await createHostedCardPayment(input);
		assert.equal(created.id, paymentId);
		assert.equal(request?.url, 'https://api.gatewaylinx.com/v1/payments');
		assert.equal((request?.init.headers as Record<string, string>).Authorization, 'Bearer fv_test_example');
		assert.deepEqual(JSON.parse(String(request?.init.body)), { surface: 'gateway_hosted', ...input });
	} finally {
		globalThis.fetch = previousFetch;
		if (previousKey === undefined) delete process.env.CARD_PAYMENTS_KEY;
		else process.env.CARD_PAYMENTS_KEY = previousKey;
	}
});

test('hosted create rejects a payment with an unexpected reference or checkout host', async () => {
	const previousKey = process.env.CARD_PAYMENTS_KEY;
	const previousFetch = globalThis.fetch;
	process.env.CARD_PAYMENTS_KEY = 'fv_test_example';
	try {
		globalThis.fetch = async () => Response.json(payment({ reference: 'OTHER-ORDER' }));
		await assert.rejects(createHostedCardPayment(input), /wrong order/);
		globalThis.fetch = async () => Response.json(payment({ checkout_url: 'https://example.com/checkout/token' }));
		await assert.rejects(createHostedCardPayment(input), /invalid checkout URL/);
	} finally {
		globalThis.fetch = previousFetch;
		if (previousKey === undefined) delete process.env.CARD_PAYMENTS_KEY;
		else process.env.CARD_PAYMENTS_KEY = previousKey;
	}
});

test('API failures preserve status and request ID without exposing the provider response', async () => {
	const previousKey = process.env.CARD_PAYMENTS_KEY;
	const previousFetch = globalThis.fetch;
	process.env.CARD_PAYMENTS_KEY = 'fv_test_example';
	try {
		globalThis.fetch = async () => new Response('<!doctype html>', { status: 530, headers: { 'content-type': 'text/html' } });
		await assert.rejects(getCardPaymentById(paymentId), (error: unknown) => error instanceof CardPaymentsApiError && error.status === 530);
		globalThis.fetch = async () => Response.json({ error: { code: 'reference_in_progress', request_id: 'req_123', retryable: false } }, { status: 409 });
		await assert.rejects(getCardPaymentById(paymentId), (error: unknown) => error instanceof CardPaymentsApiError && error.code === 'reference_in_progress' && error.requestId === 'req_123');
	} finally {
		globalThis.fetch = previousFetch;
		if (previousKey === undefined) delete process.env.CARD_PAYMENTS_KEY;
		else process.env.CARD_PAYMENTS_KEY = previousKey;
	}
});

test('a declined payment is read by its saved ID after its reference is released', async () => {
	const previousKey = process.env.CARD_PAYMENTS_KEY;
	const previousFetch = globalThis.fetch;
	process.env.CARD_PAYMENTS_KEY = 'fv_test_example';
	const paths: string[] = [];
	globalThis.fetch = async (url) => {
		paths.push(String(url));
		if (String(url).includes('/by-reference/')) return Response.json({ error: { code: 'not_found' } }, { status: 404 });
		return Response.json(payment({ status: 'declined', outcome: 'failed', final: true }));
	};
	try {
		const result = await getCurrentCardPayment(input.reference, paymentId);
		assert.equal(result.outcome, 'failed');
		assert.deepEqual(paths, [`https://api.gatewaylinx.com/v1/payments/${paymentId}`]);
	} finally {
		globalThis.fetch = previousFetch;
		if (previousKey === undefined) delete process.env.CARD_PAYMENTS_KEY;
		else process.env.CARD_PAYMENTS_KEY = previousKey;
	}
});
