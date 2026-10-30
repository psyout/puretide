import test from 'node:test';
import assert from 'node:assert/strict';
import { getDiscountedPrice, getQuantityDiscount } from '../lib/pricing';

test('quantity pricing uses the displayed 1–2, 3–4, and 5+ brackets', () => {
	assert.equal(getQuantityDiscount(1), 0);
	assert.equal(getQuantityDiscount(2), 0);
	assert.equal(getQuantityDiscount(3), 0.1);
	assert.equal(getQuantityDiscount(4), 0.1);
	assert.equal(getQuantityDiscount(5), 0.2);
	assert.equal(getQuantityDiscount(20), 0.2);
});

test('quantity pricing matches the competitor example proportions', () => {
	assert.equal(getDiscountedPrice(49.99, 2), 49.99);
	assert.equal(getDiscountedPrice(49.99, 3).toFixed(2), '44.99');
	assert.equal(getDiscountedPrice(49.99, 5).toFixed(2), '39.99');
});
