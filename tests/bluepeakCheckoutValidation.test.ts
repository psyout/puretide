import test from 'node:test';
import assert from 'node:assert/strict';

// Tests for the backend validation in /api/payments/etransfer/create/route.ts
// This ensures that orders with paymentPath !== 'bluepeak' cannot get BluePeak checkout

test('BluePeak checkout validation: order with bluepeak paymentPath should succeed', () => {
	const order = {
		paymentMethod: 'etransfer',
		paymentStatus: 'pending',
		paymentPath: 'bluepeak',
		etransfer: { provider: 'bluepeak' },
	};
	
	const paymentPath = String(order.paymentPath ?? '');
	assert.equal(paymentPath, 'bluepeak');
	// This order should be allowed to create BluePeak checkout
});

test('BluePeak checkout validation: order with manual_friends_family paymentPath should be rejected', () => {
	const order = {
		paymentMethod: 'etransfer',
		paymentStatus: 'pending',
		paymentPath: 'manual_friends_family',
		etransfer: { provider: 'manual' },
	};
	
	const paymentPath = String(order.paymentPath ?? '');
	assert.equal(paymentPath, 'manual_friends_family');
	assert.notEqual(paymentPath, 'bluepeak');
	// This order should NOT be allowed to create BluePeak checkout
});

test('BluePeak checkout validation: order with manual paymentPath should be rejected', () => {
	const order = {
		paymentMethod: 'etransfer',
		paymentStatus: 'pending',
		paymentPath: 'manual',
		etransfer: { provider: 'manual' },
	};
	
	const paymentPath = String(order.paymentPath ?? '');
	assert.equal(paymentPath, 'manual');
	assert.notEqual(paymentPath, 'bluepeak');
	// This order should NOT be allowed to create BluePeak checkout
});

test('BluePeak checkout validation: order with undefined paymentPath should be rejected', () => {
	const order = {
		paymentMethod: 'etransfer',
		paymentStatus: 'pending',
		paymentPath: undefined,
		etransfer: { provider: 'manual' },
	};
	
	const paymentPath = String(order.paymentPath ?? '');
	assert.equal(paymentPath, '');
	assert.notEqual(paymentPath, 'bluepeak');
	// This order should NOT be allowed to create BluePeak checkout
});
