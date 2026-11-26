import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldReturnToCart } from '../lib/cardPaymentReturn';
import type { CardPayment } from '../lib/cardPaymentsApi';

const base: CardPayment = {
	id: `pay_${'a'.repeat(32)}`,
	reference: 'ORDER-123',
	status: 'pending_action',
	outcome: 'in_progress',
	final: false,
	poll_after_seconds: 10,
	amount: { amount_minor: 100, currency: 'CAD' },
	amount_matches: null,
	next_action: null,
	expires_at: null,
	attempts: [{ result: 'pending' }],
};

test('a hosted return before card submission resumes the cart', () => {
	assert.equal(shouldReturnToCart(base, base.reference, base.id), true);
});

test('attempted, uncertain, or mismatched payments stay on confirmation', () => {
	assert.equal(shouldReturnToCart({ ...base, attempts: [{ result: 'captured' }] }, base.reference, base.id), false);
	assert.equal(shouldReturnToCart({ ...base, status: 'submitted' }, base.reference, base.id), false);
	assert.equal(shouldReturnToCart({ ...base, status: 'captured', outcome: 'paid', final: true }, base.reference, base.id), false);
	assert.equal(shouldReturnToCart({ ...base, attempts: undefined }, base.reference, base.id), false);
	assert.equal(shouldReturnToCart(base, 'OTHER-ORDER', base.id), false);
	assert.equal(shouldReturnToCart(base, base.reference, `pay_${'b'.repeat(32)}`), false);
});
