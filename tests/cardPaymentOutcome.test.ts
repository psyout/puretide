import test from 'node:test';
import assert from 'node:assert/strict';
import { decideCardPayment } from '../lib/cardPaymentOutcome';
import type { CardPayment } from '../lib/cardPaymentsApi';

const base: CardPayment = {
	id: `pay_${'a'.repeat(32)}`,
	reference: 'ORDER-123',
	status: 'captured',
	outcome: 'paid',
	final: true,
	poll_after_seconds: null,
	amount: { amount_minor: 100, currency: 'CAD' },
	amount_matches: true,
	next_action: null,
	expires_at: null,
};

test('only an exact final paid result releases the order', () => {
	assert.equal(decideCardPayment(base, 'ORDER-123', 100), 'paid');
	assert.equal(decideCardPayment({ ...base, final: false }, 'ORDER-123', 100), 'pending');
	assert.equal(decideCardPayment({ ...base, reference: 'OTHER' }, 'ORDER-123', 100), 'review');
	assert.equal(decideCardPayment({ ...base, amount: { amount_minor: 101, currency: 'CAD' } }, 'ORDER-123', 100), 'review');
	assert.equal(decideCardPayment({ ...base, amount: { amount_minor: 100, currency: 'USD' } }, 'ORDER-123', 100), 'review');
	assert.equal(decideCardPayment({ ...base, amount_matches: false }, 'ORDER-123', 100), 'review');
});

test('declines, canceled payments, and unknown outcomes stay safe', () => {
	assert.equal(decideCardPayment({ ...base, outcome: 'failed', status: 'declined' }, 'ORDER-123', 100), 'failed');
	assert.equal(decideCardPayment({ ...base, outcome: 'failed', status: 'canceled' }, 'ORDER-123', 100), 'review');
	assert.equal(decideCardPayment({ ...base, outcome: 'needs_attention' }, 'ORDER-123', 100), 'review');
	assert.equal(decideCardPayment({ ...base, outcome: 'future_value' }, 'ORDER-123', 100), 'review');
	assert.equal(decideCardPayment({ ...base, outcome: 'in_progress', final: false }, 'ORDER-123', 100), 'pending');
});
