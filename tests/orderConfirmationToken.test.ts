import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderConfirmationToken, verifyOrderConfirmationToken } from '../lib/orderConfirmationToken';

test('creates and validates confirmation token', () => {
	process.env.ORDER_CONFIRMATION_SECRET = 'test-secret';
	const now = 1_000_000;
	const token = createOrderConfirmationToken('ABC123', now, 10_000);
	assert.ok(token);
	assert.equal(verifyOrderConfirmationToken('ABC123', token, now + 1_000), true);
});

test('rejects invalid or expired tokens', () => {
	process.env.ORDER_CONFIRMATION_SECRET = 'test-secret';
	const now = 1_000_000;
	const token = createOrderConfirmationToken('ABC123', now, 500);
	assert.ok(token);
	assert.equal(verifyOrderConfirmationToken('ABC123', token, now + 2_000), false);
	assert.equal(verifyOrderConfirmationToken('ABC123', 'invalid.token', now), false);
	assert.equal(verifyOrderConfirmationToken('DIFFERENT', token, now), false);
});
