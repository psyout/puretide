import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrderPaymentPresentation } from '../lib/orderPaymentPresentation';

test('Family & Friends uses the manual Interac payment recipient', () => {
	const payment = getOrderPaymentPresentation({
		paymentMethod: 'etransfer',
		paymentPath: 'manual_friends_family',
		depositEmail: 'must-not-be-used@etransfercanada.ca',
	});

	assert.equal(payment.customerType, 'Family & Friends');
	assert.equal(payment.pipeline, 'Manual Interac');
	assert.equal(payment.paymentRecipientEmail, 'orders@puretide.ca');
});

test('BluePeak preserves the generated payment recipient', () => {
	const payment = getOrderPaymentPresentation({
		paymentMethod: 'etransfer',
		paymentPath: 'bluepeak',
		depositEmail: ' checkout-123@etransfercanada.ca ',
	});

	assert.equal(payment.customerType, 'Regular Customer');
	assert.equal(payment.pipeline, 'BluePeak');
	assert.equal(payment.paymentRecipientEmail, 'checkout-123@etransfercanada.ca');
});
