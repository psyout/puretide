import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCartStockMap, hasInvalidCartQuantity, resolveCartItemStock } from '../lib/cartStock';
import type { CartItem, Product } from '../types/product';

const product: Product = {
	id: 'mots-c',
	slug: 'mots-c',
	name: 'MOTS-C',
	description: '',
	price: 100,
	stock: 12,
	image: '',
	category: 'Metabolic',
	variants: [
		{ key: 'mots-c-10', label: '10mg', price: 100, stock: 3 },
		{ key: 'mots-c-40', label: '40mg', price: 200, stock: 8 },
	],
};

const variantCartItem: CartItem = {
	...product,
	id: 'mots-c-40',
	stock: 8,
	quantity: 4,
};

test('cart stock resolves a selected variant instead of parent stock', () => {
	const stockMap = buildCartStockMap([product]);
	assert.equal(resolveCartItemStock(stockMap, variantCartItem), 8);
	assert.equal(hasInvalidCartQuantity(stockMap, [variantCartItem], false), false);
});

test('inventory refresh failure uses the stock snapshot stored with the cart item', () => {
	const stockMap = new Map<string, number>();
	assert.equal(hasInvalidCartQuantity(stockMap, [variantCartItem], true), false);
	assert.equal(hasInvalidCartQuantity(stockMap, [{ ...variantCartItem, quantity: 9 }], true), true);
});

test('available inventory still blocks genuinely excessive quantities', () => {
	const stockMap = buildCartStockMap([product]);
	assert.equal(hasInvalidCartQuantity(stockMap, [{ ...variantCartItem, quantity: 9 }], false), true);
});
