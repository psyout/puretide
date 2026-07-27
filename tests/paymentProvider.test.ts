import test from 'node:test';
import assert from 'node:assert/strict';

import { getCreditCardProvider, getPaymentProvider } from '../lib/paymentProvider';
import { validateEnv } from '../lib/env';

Object.assign(process.env, { NODE_ENV: 'test', DASHBOARD_SECRET: 'test-dashboard-secret' });
process.env.ORDER_CONFIRMATION_SECRET = 'test-order-confirmation-secret';
process.env.DIGIPAY_SITE_ID = 'test-digipay-site';
process.env.DIGIPAY_SECRET_KEY = 'test-digipay-secret';
process.env.GATEWAYLINX_SITE_ID = 'test-gatewaylinx-site';
process.env.GATEWAYLINX_HMAC_KEY = 'test-gatewaylinx-hmac';
process.env.GATEWAYLINX_RELAY_URL = 'https://gatewaylinx.test/order';
validateEnv();

test('credit card provider defaults to digipay when env var is unset', () => {
	const prior = process.env.CREDIT_CARD_PROVIDER;
	delete process.env.CREDIT_CARD_PROVIDER;

	assert.equal(getCreditCardProvider(), 'digipay');

	if (prior === undefined) delete process.env.CREDIT_CARD_PROVIDER;
	else process.env.CREDIT_CARD_PROVIDER = prior;
});

test('credit card provider selects digipay explicitly', () => {
	const prior = process.env.CREDIT_CARD_PROVIDER;
	process.env.CREDIT_CARD_PROVIDER = 'digipay';

	assert.equal(getCreditCardProvider(), 'digipay');

	const provider = getPaymentProvider();
	assert.equal(typeof provider.createPaymentSession, 'function');
	assert.equal(typeof provider.validatePaymentNotification, 'function');

	if (prior === undefined) delete process.env.CREDIT_CARD_PROVIDER;
	else process.env.CREDIT_CARD_PROVIDER = prior;
});

test('credit card provider selects gatewaylinx explicitly', () => {
	const prior = process.env.CREDIT_CARD_PROVIDER;
	process.env.CREDIT_CARD_PROVIDER = 'gatewaylinx';

	assert.equal(getCreditCardProvider(), 'gatewaylinx');
	const provider = getPaymentProvider();
	assert.equal(typeof provider.createPaymentSession, 'function');
	assert.equal(typeof provider.validatePaymentNotification, 'function');

	if (prior === undefined) delete process.env.CREDIT_CARD_PROVIDER;
	else process.env.CREDIT_CARD_PROVIDER = prior;
});
