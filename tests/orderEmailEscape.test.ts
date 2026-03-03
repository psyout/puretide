import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderEmails } from '../lib/orderEmail';

test('escapes html in user-controlled order email fields', () => {
	const result = buildOrderEmails({
		orderNumber: 'ABC123',
		createdAt: new Date().toISOString(),
		paymentMethod: 'etransfer',
		customer: {
			firstName: '<script>alert(1)</script>',
			lastName: 'User',
			country: 'Canada',
			email: 'test@example.com',
			address: '123 <b>Main</b>',
			addressLine2: '',
			city: 'Vancouver',
			province: 'BC',
			zipCode: 'V1V1V1',
			orderNotes: '<img src=x onerror=alert(1)>',
		},
		shipToDifferentAddress: false,
		shippingMethod: 'express',
		subtotal: 10,
		shippingCost: 5,
		total: 15,
		promoCode: '<svg/onload=alert(1)>',
		discountAmount: 1,
		cartItems: [{ id: 1, name: '<iframe>', price: 10, quantity: 1 }],
	});

	assert.doesNotMatch(result.customer.html, /<script>alert\(1\)<\/script>/);
	assert.match(result.customer.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
	assert.doesNotMatch(result.admin.html, /<img src=x onerror=alert\(1\)>/);
	assert.match(result.admin.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
