import test from 'node:test';
import assert from 'node:assert/strict';

import { getCreditCardProvider, getPaymentProvider } from '../lib/paymentProvider';

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

test('credit card provider selects gatewaylinx explicitly (not implemented in stage 1)', () => {
	const prior = process.env.CREDIT_CARD_PROVIDER;
	process.env.CREDIT_CARD_PROVIDER = 'gatewaylinx';

	assert.equal(getCreditCardProvider(), 'gatewaylinx');
	assert.throws(() => getPaymentProvider(), /Gatewaylinx provider not implemented yet/);

	if (prior === undefined) delete process.env.CREDIT_CARD_PROVIDER;
	else process.env.CREDIT_CARD_PROVIDER = prior;
});
