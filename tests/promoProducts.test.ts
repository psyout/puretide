import test from 'node:test';
import assert from 'node:assert/strict';

import { getPromoDiscountAmount, getPromoEligibleSubtotal, getPromoProductEligibilityError } from '../lib/promo';
import type { PromoCode } from '../types/product';

const items = [
	{ id: 'bpc-157', price: 70, quantity: 2 },
	{ id: 'ghk-cu', price: 50, quantity: 1 },
];

test('a promo with no product selection discounts all products', () => {
	const promo: PromoCode = { code: 'SAVE10', discount: 10, active: true };
	assert.equal(getPromoEligibleSubtotal(promo, items), 190);
	assert.equal(getPromoDiscountAmount(promo, items), 19);
	assert.equal(getPromoProductEligibilityError(promo, items), null);
});

test('a product-specific promo only discounts selected product IDs', () => {
	const promo: PromoCode = { code: 'BPC10', discount: 10, productIds: ['bpc-157'], active: true };
	assert.equal(getPromoEligibleSubtotal(promo, items), 140);
	assert.equal(getPromoDiscountAmount(promo, items), 14);
});

test('a product-specific promo gives no discount without an eligible cart item', () => {
	const promo: PromoCode = { code: 'OTHER10', discount: 10, productIds: ['other'], active: true };
	assert.equal(getPromoDiscountAmount(promo, items), 0);
	assert.equal(getPromoProductEligibilityError(promo, items), 'OTHER10 does not apply to the products in your cart.');
});
