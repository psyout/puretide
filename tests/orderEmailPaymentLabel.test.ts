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
	assert.match(result.admin.html, /Method:<\/strong> Credit card/);
});

test('admin email shows regular Interac e-Transfer payment method', () => {
	const result = buildOrderEmails({
		...baseOrder,
		paymentMethod: 'etransfer',
		paymentPath: 'manual',
	});
	assert.match(result.admin.text, /Method: Interac e-Transfer/);
	assert.match(result.admin.html, /Method:<\/strong> Interac e-Transfer/);
});

test('pending manual e-transfer customer email contains complete payment instructions', () => {
	const result = buildOrderEmails({
		...baseOrder,
		paymentMethod: 'etransfer',
		paymentPath: 'manual',
		paymentConfirmed: false,
	});
	assert.equal(result.customer.subject, 'Order #ABC123 - e-Transfer payment instructions');
	assert.match(result.customer.text, /Recipient Email: orders@puretide\.ca/);
	assert.match(result.customer.text, /Memo\/Message: ABC123/);
	assert.match(result.customer.text, /Total: \$115\.00/);
});

test('confirmed manual e-transfer customer email confirms payment without repeating transfer instructions', () => {
	const result = buildOrderEmails({
		...baseOrder,
		paymentMethod: 'etransfer',
		paymentPath: 'manual',
		paymentConfirmed: true,
	});
	assert.equal(result.customer.subject, 'Order #ABC123 - Payment received');
	assert.match(result.customer.text, /confirmed your Interac e-Transfer payment/);
	assert.doesNotMatch(result.customer.text, /Recipient Email:/);
});

test('admin email shows Friends & Family Interac e-Transfer payment method', () => {
	const result = buildOrderEmails({
		...baseOrder,
		paymentMethod: 'etransfer',
		paymentPath: 'manual_friends_family',
	});
	assert.match(result.admin.text, /Customer type: Family & Friends/);
	assert.match(result.admin.text, /Pipeline: Manual Interac/);
	assert.match(result.admin.text, /Payment recipient email: orders@puretide\.ca/);
	assert.doesNotMatch(result.admin.text, /BluePeak/);
});

test('admin email shows BluePeak Interac e-Transfer payment method', () => {
	const result = buildOrderEmails({
		...baseOrder,
		paymentMethod: 'etransfer',
		paymentPath: 'bluepeak',
		paymentRecipientEmail: 'checkout-123@etransfercanada.ca',
	});
	assert.match(result.admin.text, /Customer type: Regular Customer/);
	assert.match(result.admin.text, /Processor: BluePeak/);
	assert.match(result.admin.text, /Payment recipient email: checkout-123@etransfercanada\.ca/);
	assert.doesNotMatch(result.admin.text, /Payment recipient email: orders@puretide\.ca/);
});
