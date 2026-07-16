import test from 'node:test';
import assert from 'node:assert/strict';

import {
	decidePaymentPathWithFeatureFlag,
	isFriendsFamilyEnabled,
	startFriendsFamilyOtpWithDeps,
	verifyFriendsFamilyOtpWithDeps,
} from '../lib/friendsFamily';

function makeRequest(): Request {
	return new Request('http://localhost/api/friends-family/start', {
		method: 'POST',
		headers: {
			// best-effort to make IP-based rate limiter deterministic
			'x-forwarded-for': '127.0.0.1',
		},
	});
}

test('friends-family feature flag disabled: payment path override does not apply', () => {
	const prior = process.env.FRIENDS_FAMILY_ENABLED;
	process.env.FRIENDS_FAMILY_ENABLED = 'false';
	assert.equal(isFriendsFamilyEnabled(), false);

	assert.equal(
		decidePaymentPathWithFeatureFlag({
			etransferProvider: 'bluepeak',
			customerEmail: 'customer@example.com',
			verifiedFriendsFamilyEmail: 'customer@example.com',
		}),
		'bluepeak',
	);

	if (prior === undefined) delete process.env.FRIENDS_FAMILY_ENABLED;
	else process.env.FRIENDS_FAMILY_ENABLED = prior;
});

test('friends-family feature flag enabled: verified email gets manual_friends_family', () => {
	const prior = process.env.FRIENDS_FAMILY_ENABLED;
	process.env.FRIENDS_FAMILY_ENABLED = 'true';
	assert.equal(isFriendsFamilyEnabled(), true);

	assert.equal(
		decidePaymentPathWithFeatureFlag({
			etransferProvider: 'bluepeak',
			customerEmail: 'customer@example.com',
			verifiedFriendsFamilyEmail: 'customer@example.com',
		}),
		'manual_friends_family',
	);

	if (prior === undefined) delete process.env.FRIENDS_FAMILY_ENABLED;
	else process.env.FRIENDS_FAMILY_ENABLED = prior;
});

test('friends-family feature flag disabled: otp start/verify do not touch deps', async () => {
	const prior = process.env.FRIENDS_FAMILY_ENABLED;
	process.env.FRIENDS_FAMILY_ENABLED = 'false';

	let insertCalled = 0;
	let allowlistCalled = 0;
	const req = makeRequest();
	const start = await startFriendsFamilyOtpWithDeps(
		req,
		{ emailRaw: 'test@example.com' },
		{
			insertOtp: async () => {
				insertCalled += 1;
			},
			isAllowlisted: async () => {
				allowlistCalled += 1;
				return true;
			},
		},
	);
	assert.equal(start.ok, true);
	assert.ok(typeof start.message === 'string');
	assert.equal(insertCalled, 0);
	assert.equal(allowlistCalled, 0);

	let verifyAllowlistCalled = 0;
	let getOtpCalled = 0;
	const verify = await verifyFriendsFamilyOtpWithDeps(
		req,
		{ email: 'test@example.com', code: '123456' },
		{
			isAllowlisted: async () => {
				verifyAllowlistCalled += 1;
				return true;
			},
			getOtp: async () => {
				getOtpCalled += 1;
				return null;
			},
			incAttempts: async () => {},
			consumeOtp: async () => {},
			createCookie: () => ({ name: 'x', value: 'y', options: 'z' }),
		},
	);
	assert.equal(verify.ok, false);
	assert.equal(verifyAllowlistCalled, 0);
	assert.equal(getOtpCalled, 0);

	if (prior === undefined) delete process.env.FRIENDS_FAMILY_ENABLED;
	else process.env.FRIENDS_FAMILY_ENABLED = prior;
});
