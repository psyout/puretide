import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCartItemsWithTrustedPrices } from '../lib/trustedCartPricing';
import type { Product } from '../types/product';

test('normalizes cart item prices from trusted products', () => {
	const products: Product[] = [{ id: '101', slug: 'sample', name: 'Sample', description: 'x', price: 55, stock: 10, image: '', category: 'cat' }];
	const cartItems = [
		{ id: 101, price: 1, quantity: 2, name: 'Sample', image: '', description: '' },
	];

	const result = normalizeCartItemsWithTrustedPrices(cartItems, products);
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.items[0].price, 55);
});

test('returns error when item does not map to a trusted product', () => {
	const products: Product[] = [{ id: '101', slug: 'sample', name: 'Sample', description: 'x', price: 55, stock: 10, image: '', category: 'cat' }];
	const cartItems = [{ id: 999, price: 1, quantity: 1, name: 'Missing', image: '', description: '' }];
	const result = normalizeCartItemsWithTrustedPrices(cartItems, products);
	assert.equal(result.ok, false);
});
