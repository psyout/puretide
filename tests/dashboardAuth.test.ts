import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionCookie, verifySessionCookie } from '../lib/dashboardAuth';

test('session cookie includes secure attribute in production', () => {
	process.env.DASHBOARD_SECRET = 'dashboard-secret';
	process.env.NODE_ENV = 'production';
	const cookie = createSessionCookie();
	assert.match(cookie.options, /HttpOnly/);
	assert.match(cookie.options, /SameSite=Strict/);
	assert.match(cookie.options, /Secure/);
});

test('malformed cookie signatures fail closed', () => {
	process.env.DASHBOARD_SECRET = 'dashboard-secret';
	process.env.NODE_ENV = 'development';
	const malformed = 'dashboard_session=1700000000000.invalid-hex';
	assert.equal(verifySessionCookie(malformed), false);
});
