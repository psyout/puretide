import assert from 'node:assert/strict';
import test from 'node:test';
import { formatClientDiscount } from '../lib/stockSheet';

test('formats a promo code and discount amount for the Clients sheet', () => {
	assert.equal(formatClientDiscount({ promoCode: 'SAVE20', discountAmount: 20 }), 'SAVE20 (-$20.00)');
});

test('tracks free-shipping promo codes even without a dollar discount', () => {
	assert.equal(formatClientDiscount({ promoCode: 'FREESHIP', discountAmount: 0 }), 'FREESHIP');
});

test('leaves the discount cell empty when no promotion was applied', () => {
	assert.equal(formatClientDiscount({}), '');
});
