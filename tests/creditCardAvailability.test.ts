import test from 'node:test';
import assert from 'node:assert/strict';
import { creditCardPaymentsEnabled } from '../lib/creditCardAvailability';

test('VPS credit-card flag is checked at request time and defaults to hidden', () => {
	const previous = process.env.NEXT_PUBLIC_ENABLE_CREDIT_CARD;
	try {
		delete process.env.NEXT_PUBLIC_ENABLE_CREDIT_CARD;
		assert.equal(creditCardPaymentsEnabled(), false);
		process.env.NEXT_PUBLIC_ENABLE_CREDIT_CARD = 'false';
		assert.equal(creditCardPaymentsEnabled(), false);
		process.env.NEXT_PUBLIC_ENABLE_CREDIT_CARD = 'true';
		assert.equal(creditCardPaymentsEnabled(), true);
	} finally {
		if (previous === undefined) delete process.env.NEXT_PUBLIC_ENABLE_CREDIT_CARD;
		else process.env.NEXT_PUBLIC_ENABLE_CREDIT_CARD = previous;
	}
});
