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

test('uses the selected Zoho variant price instead of the parent price', () => {
	const products: Product[] = [{
		id: 'retatrutide',
		slug: 'retatrutide',
		name: 'Retatrutide',
		description: 'x',
		price: 150,
		stock: 99,
		image: '',
		category: 'Metabolic',
		variants: [
			{ key: 'retatrutide-10mg', label: '10mg', price: 90, stock: 5 },
			{ key: 'retatrutide-20mg', label: '20mg', price: 150, stock: 99 },
		],
	}];
	const result = normalizeCartItemsWithTrustedPrices(
		[{ id: 'retatrutide-10mg', price: 1, quantity: 1 }],
		products,
	);

	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.items[0].id, 'retatrutide-10mg');
	assert.equal(result.items[0].price, 90);
});

test('returns error when item does not map to a trusted product', () => {
	const products: Product[] = [{ id: '101', slug: 'sample', name: 'Sample', description: 'x', price: 55, stock: 10, image: '', category: 'cat' }];
	const cartItems = [{ id: 999, price: 1, quantity: 1, name: 'Missing', image: '', description: '' }];
	const result = normalizeCartItemsWithTrustedPrices(cartItems, products);
	assert.equal(result.ok, false);
});

test('returns error when a trusted product is not published', () => {
	const products: Product[] = [{ id: 'sample', slug: 'sample', name: 'Sample', description: 'x', price: 55, stock: 10, image: '', category: 'cat', status: 'draft' }];
	const cartItems = [{ id: 'sample', price: 55, quantity: 1, name: 'Sample', image: '', description: '' }];
	const result = normalizeCartItemsWithTrustedPrices(cartItems, products);
	assert.equal(result.ok, false);
});
