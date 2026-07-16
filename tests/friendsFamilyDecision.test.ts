import test from 'node:test';
import assert from 'node:assert/strict';

import { decidePaymentPath } from '../lib/friendsFamily';

test('decidePaymentPath: regular customer + manual provider -> manual', () => {
	const path = decidePaymentPath({
		etransferProvider: 'manual',
		customerEmail: 'Customer@Example.com',
		verifiedFriendsFamilyEmail: null,
	});
	assert.equal(path, 'manual');
});

test('decidePaymentPath: regular customer + bluepeak provider -> bluepeak', () => {
	const path = decidePaymentPath({
		etransferProvider: 'bluepeak',
		customerEmail: 'customer@example.com',
		verifiedFriendsFamilyEmail: null,
	});
	assert.equal(path, 'bluepeak');
});

test('decidePaymentPath: verified friends/family overrides provider -> manual_friends_family', () => {
	const path = decidePaymentPath({
		etransferProvider: 'bluepeak',
		customerEmail: 'customer@example.com',
		verifiedFriendsFamilyEmail: 'customer@example.com',
	});
	assert.equal(path, 'manual_friends_family');
});

test('decidePaymentPath: verified cookie email mismatch -> no override', () => {
	const path = decidePaymentPath({
		etransferProvider: 'bluepeak',
		customerEmail: 'customer@example.com',
		verifiedFriendsFamilyEmail: 'other@example.com',
	});
	assert.equal(path, 'bluepeak');
});
