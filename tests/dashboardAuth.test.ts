import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionCookie, verifySessionCookie } from '../lib/dashboardAuth';

const originalNodeEnv = process.env.NODE_ENV;
const originalDashboardSecret = process.env.DASHBOARD_SECRET;

function setTestEnv(name: 'NODE_ENV' | 'DASHBOARD_SECRET', value: string) {
	Reflect.set(process.env, name, value);
}

function restoreTestEnv(name: 'NODE_ENV' | 'DASHBOARD_SECRET', value: string | undefined) {
	if (value === undefined) {
		Reflect.deleteProperty(process.env, name);
		return;
	}
	Reflect.set(process.env, name, value);
}

test.afterEach(() => {
	restoreTestEnv('NODE_ENV', originalNodeEnv);
	restoreTestEnv('DASHBOARD_SECRET', originalDashboardSecret);
});

test('session cookie includes secure attribute in production', () => {
	setTestEnv('DASHBOARD_SECRET', 'dashboard-secret');
	setTestEnv('NODE_ENV', 'production');
	const cookie = createSessionCookie();
	assert.match(cookie.options, /HttpOnly/);
	assert.match(cookie.options, /SameSite=Strict/);
	assert.match(cookie.options, /Secure/);
});

test('malformed cookie signatures fail closed', () => {
	setTestEnv('DASHBOARD_SECRET', 'dashboard-secret');
	setTestEnv('NODE_ENV', 'development');
	const malformed = 'dashboard_session=1700000000000.invalid-hex';
	assert.equal(verifySessionCookie(malformed), false);
});
