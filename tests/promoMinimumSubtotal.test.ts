import test from 'node:test';
import assert from 'node:assert/strict';

import { getPromoMinimumSubtotalError } from '../lib/promo';
import type { PromoCode } from '../types/product';

test('CANADIAN10 works as before (no minimumSubtotal)', () => {
	const promo: PromoCode = { code: 'CANADIAN10', discount: 10, active: true };
	assert.equal(getPromoMinimumSubtotalError({ promo, subtotal: 0 }), null);
	assert.equal(getPromoMinimumSubtotalError({ promo, subtotal: 100 }), null);
});

test('CANADIAN20 works at $350+ (minimumSubtotal=350)', () => {
	const promo: PromoCode = { code: 'CANADIAN20', discount: 20, active: true, minimumSubtotal: 350 };
	assert.equal(getPromoMinimumSubtotalError({ promo, subtotal: 350 }), null);
	assert.equal(getPromoMinimumSubtotalError({ promo, subtotal: 500 }), null);
});

test('CANADIAN20 fails below $350 with clear error message', () => {
	const promo: PromoCode = { code: 'CANADIAN20', discount: 20, active: true, minimumSubtotal: 350 };
	assert.equal(getPromoMinimumSubtotalError({ promo, subtotal: 349.99 }), 'CANADIAN20 requires a minimum order of $350.');
});

test('subtotal basis is product subtotal before shipping/fees (sum(price*qty))', () => {
	const promo: PromoCode = { code: 'CANADIAN20', discount: 20, active: true, minimumSubtotal: 350 };
	const cartItems = [
		{ price: 100, quantity: 2 },
		{ price: 50, quantity: 3 },
	];
	const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
	assert.equal(subtotal, 350);
	assert.equal(getPromoMinimumSubtotalError({ promo, subtotal }), null);
});
