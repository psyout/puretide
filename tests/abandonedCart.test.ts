import test from 'node:test';
import assert from 'node:assert/strict';
import {
	buildAbandonedCartEmail,
	createAbandonedCartToken,
	resolveRecoverableCartItems,
	verifyAbandonedCartToken,
} from '../lib/abandonedCart';
import type { Product } from '../types/product';

process.env['ABANDONED_CART_SECRET'] = 'test-only-abandoned-cart-secret';

test('abandoned cart tokens verify only for their purpose and before expiry', () => {
	const now = Date.now();
	const token = createAbandonedCartToken('cart_1234567890123456', 'recover', now + 60_000);
	assert.deepEqual(verifyAbandonedCartToken(token, 'recover', now), {
		cartId: 'cart_1234567890123456',
		expiresAtMs: now + 60_000,
	});
	assert.equal(verifyAbandonedCartToken(token, 'unsubscribe', now), null);
	assert.equal(verifyAbandonedCartToken(token, 'recover', now + 60_001), null);
	assert.equal(verifyAbandonedCartToken(`${token}tampered`, 'recover', now), null);
});

test('recovery uses current product price and caps quantity to current stock', () => {
	const products: Product[] = [
		{
			id: 'serum',
			slug: 'serum',
			name: 'Serum',
			description: 'Test',
			price: 25,
			stock: 2,
			image: '/serum.png',
			category: 'Test',
			status: 'published',
		},
	];
	const recovered = resolveRecoverableCartItems([{ id: 'serum', quantity: 5 }], products);
	assert.equal(recovered.length, 1);
	assert.equal(recovered[0].price, 25);
	assert.equal(recovered[0].quantity, 2);
});

test('abandoned cart email escapes customer-controlled content and includes unsubscribe', () => {
	const result = buildAbandonedCartEmail({
		firstName: '<script>alert(1)</script>',
		items: [{ id: '1', name: '<b>Unsafe</b>', quantity: 1, price: 10 }],
		recoveryUrl: 'https://puretide.ca/cart/recover?token=safe',
		unsubscribeUrl: 'https://puretide.ca/api/abandoned-carts/unsubscribe?token=safe',
		businessAddress: '123 Test Street, Vancouver, BC',
		contactEmail: 'info@puretide.ca',
	});
	assert.doesNotMatch(result.html, /<script>/);
	assert.doesNotMatch(result.html, /<b>Unsafe<\/b>/);
	assert.match(result.html, /Unsubscribe from cart reminders/);
	assert.match(result.text, /Estimated subtotal: \$10\.00 CAD/);
	assert.match(result.text, /123 Test Street/);
});
