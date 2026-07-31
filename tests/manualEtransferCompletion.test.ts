import assert from 'node:assert/strict';
import test from 'node:test';
import { isManualEtransferOrder } from '../lib/friendsFamilyOrderCompletion';

test('regular manual e-transfer can be completed after admin confirms transfer', () => {
	assert.equal(isManualEtransferOrder({ paymentMethod: 'etransfer', paymentPath: 'manual' }), true);
});

test('legacy Friends & Family manual e-transfer can still be completed', () => {
	assert.equal(isManualEtransferOrder({ paymentMethod: 'etransfer', paymentPath: 'manual_friends_family' }), true);
});

test('BluePeak e-transfer is not handled by the manual completion workflow', () => {
	assert.equal(isManualEtransferOrder({ paymentMethod: 'etransfer', paymentPath: 'bluepeak' }), false);
});
