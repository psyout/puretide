import test from 'node:test';
import assert from 'node:assert/strict';

import { applyPromoVerifyResponse } from '../lib/checkoutPromoRevalidation';

test('Apply CANADIAN20 at $350+, then reduce below $350 -> discount removed', () => {
	const applied = applyPromoVerifyResponse({
		code: 'CANADIAN20',
		response: { ok: true, discount: 20, freeShipping: false },
	});
	assert.equal(applied.appliedPromoCode, 'CANADIAN20');
	assert.equal(applied.appliedDiscount, 20);
	assert.equal(applied.promoError, null);

	const afterReduce = applyPromoVerifyResponse({
		code: 'CANADIAN20',
		response: { ok: false, error: 'CANADIAN20 requires a minimum order of $350.' },
	});
	assert.equal(afterReduce.appliedPromoCode, null);
	assert.equal(afterReduce.appliedDiscount, 0);
	assert.equal(afterReduce.appliedFreeShipping, false);
	assert.equal(afterReduce.promoError, 'CANADIAN20 requires a minimum order of $350.');
});

test('Apply CANADIAN20 below $350 -> rejected', () => {
	const state = applyPromoVerifyResponse({
		code: 'canadian20',
		response: { ok: false, error: 'CANADIAN20 requires a minimum order of $350.' },
	});
	assert.equal(state.appliedPromoCode, null);
	assert.equal(state.appliedDiscount, 0);
	assert.equal(state.promoError, 'CANADIAN20 requires a minimum order of $350.');
});

test('Apply CANADIAN20 at $350+, cart changes but stays >= $350 -> discount stays applied (recomputed)', () => {
	const state = applyPromoVerifyResponse({
		code: 'CANADIAN20',
		response: { ok: true, discount: 20, freeShipping: false },
	});
	assert.equal(state.appliedPromoCode, 'CANADIAN20');
	assert.equal(state.appliedDiscount, 20);
	assert.equal(state.promoError, null);
});
