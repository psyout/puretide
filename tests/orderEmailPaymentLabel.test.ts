import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderEmails } from '../lib/orderEmail';

const baseOrder = {
	orderNumber: 'ABC123',
	createdAt: new Date().toISOString(),
	customer: {
		firstName: 'John',
		lastName: 'Doe',
		country: 'Canada',
		email: 'john@example.com',
		address: '123 Main St',
		addressLine2: '',
		city: 'Toronto',
		province: 'ON',
		zipCode: 'M5V 2T6',
		orderNotes: '',
	},
	shipToDifferentAddress: false,
	shippingMethod: 'express' as const,
	subtotal: 100,
	shippingCost: 15,
	total: 115,
	cartItems: [{ id: 'p1', name: 'Product', price: 100, quantity: 1 }],
};

test('admin email shows credit card payment method', () => {
	const result = buildOrderEmails({
		...baseOrder,
		paymentMethod: 'creditcard',
	});
	assert.match(result.admin.text, /Payment method: Credit card/);
	assert.match(result.admin.html, /Payment method:<\/strong> Credit card/);
});

test('admin email shows regular Interac e-Transfer payment method', () => {
	const result = buildOrderEmails({
		...baseOrder,
		paymentMethod: 'etransfer',
		paymentPath: 'manual',
	});
	assert.match(result.admin.text, /Payment method: Interac e-Transfer/);
	assert.match(result.admin.html, /Payment method:<\/strong> Interac e-Transfer/);
});

test('admin email shows Friends & Family Interac e-Transfer payment method', () => {
	const result = buildOrderEmails({
		...baseOrder,
		paymentMethod: 'etransfer',
		paymentPath: 'manual_friends_family',
	});
	assert.match(result.admin.text, /Payment method: Friends & Family Interac e-Transfer/);
	assert.match(result.admin.html, /Payment method:<\/strong> Friends &amp; Family Interac e-Transfer/);
});

test('admin email shows BluePeak Interac e-Transfer payment method', () => {
	const result = buildOrderEmails({
		...baseOrder,
		paymentMethod: 'etransfer',
		paymentPath: 'bluepeak',
	});
	assert.match(result.admin.text, /Payment method: Interac e-Transfer \(BluePeak\)/);
	assert.match(result.admin.html, /Payment method:<\/strong> Interac e-Transfer \(BluePeak\)/);
});
