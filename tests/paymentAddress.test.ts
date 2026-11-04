import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentCountryCode, paymentRegionCode } from '../lib/paymentAddress';

test('normalizes Canadian checkout addresses for payment gateways', () => {
	assert.equal(paymentCountryCode('Canada'), 'CA');
	assert.equal(paymentCountryCode(' ca '), 'CA');
	assert.equal(paymentRegionCode('Alberta', 'CA'), 'AB');
	assert.equal(paymentRegionCode('British Columbia', 'CA'), 'BC');
	assert.equal(paymentRegionCode('Newfoundland and Labrador', 'CA'), 'NL');
	assert.equal(paymentRegionCode('Northwest Territories', 'CA'), 'NT');
	assert.equal(paymentRegionCode('AB', 'CA'), 'AB');
});
