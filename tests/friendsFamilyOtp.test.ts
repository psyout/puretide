import test from 'node:test';
import assert from 'node:assert/strict';

import crypto from 'crypto';

import {
	createFriendsFamilySessionCookie,
	getVerifiedFriendsFamilyEmailFromCookie,
	normalizeEmail,
} from '../lib/friendsFamily';

function parseSetCookie(headerValue: string): { name: string; value: string } {
	const first = headerValue.split(';')[0] ?? '';
	const idx = first.indexOf('=');
	if (idx <= 0) return { name: '', value: '' };
	return { name: first.slice(0, idx), value: first.slice(idx + 1) };
}

test('normalizeEmail trims and lowercases', () => {
	assert.equal(normalizeEmail('  TeSt@Example.com  '), 'test@example.com');
});

test('friends/family session cookie verifies and expires', () => {
	process.env.ORDER_CONFIRMATION_SECRET = crypto.randomBytes(16).toString('hex');
	const now = Date.now();
	const cookie = createFriendsFamilySessionCookie('Test@Example.com', now);
	const parsed = parseSetCookie(`${cookie.name}=${cookie.value}; ${cookie.options}`);
	const header = `${parsed.name}=${parsed.value}`;

	assert.equal(getVerifiedFriendsFamilyEmailFromCookie(header, now), 'test@example.com');
	assert.equal(getVerifiedFriendsFamilyEmailFromCookie(header, now + 25 * 60 * 60 * 1000), null);
});
