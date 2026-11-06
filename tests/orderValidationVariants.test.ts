import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStockAvailability } from '../lib/orderValidation';

const products = [{
	id: 'retatrutide',
	slug: 'retatrutide',
	name: 'Retatrutide',
	stock: 104,
	status: 'published' as const,
	variants: [
		{ key: 'retatrutide-10mg', label: '10mg', stock: 5 },
		{ key: 'retatrutide-20mg', label: '20mg', stock: 99 },
	],
}];

test('validates stock against the selected variant rather than combined product stock', async () => {
	assert.equal(
		await validateStockAvailability(
			[{ id: 'retatrutide-10mg', name: 'Retatrutide - 10mg', quantity: 6 }],
			async () => products,
		),
		'Insufficient stock for "Retatrutide - 10mg". Available: 5, requested: 6.',
	);
	assert.equal(
		await validateStockAvailability(
			[{ id: 'retatrutide-20mg', name: 'Retatrutide - 20mg', quantity: 6 }],
			async () => products,
		),
		null,
	);
});
