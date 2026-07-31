import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldSetAwaitingTransferStatus } from '../lib/wrike';

test('regular manual e-transfer awaiting payment gets the Wrike awaiting-transfer status', () => {
	assert.equal(
		shouldSetAwaitingTransferStatus({
			paymentMethod: 'etransfer',
			paymentConfirmed: false,
		}),
		true,
	);
});

test('confirmed e-transfer does not get the Wrike awaiting-transfer status', () => {
	assert.equal(
		shouldSetAwaitingTransferStatus({
			paymentMethod: 'etransfer',
			paymentConfirmed: true,
		}),
		false,
	);
});

test('credit-card order does not get the Wrike awaiting-transfer status', () => {
	assert.equal(
		shouldSetAwaitingTransferStatus({
			paymentMethod: 'creditcard',
			paymentConfirmed: false,
		}),
		false,
	);
});
