import assert from 'node:assert/strict';
import test from 'node:test';
import { buildManualEtransferReminderEmail, isManualEtransferReminderDue } from '../lib/manualEtransferReminder';

const now = Date.parse('2026-10-13T20:00:00.000Z');
const order = {
	orderNumber: 'PT123',
	createdAt: '2026-10-13T07:00:00.000Z',
	paymentStatus: 'pending',
	paymentMethod: 'etransfer',
	paymentPath: 'manual',
	wrikeTaskId: 'IEAA123',
	subtotal: 110,
	shippingCost: 15,
	total: 125,
	cartItems: [
		{ name: 'BPC-157 Peptide', price: 50, quantity: 2 },
		{ name: 'KPV Oral Tablets', price: 10, quantity: 1 },
	],
	customer: { firstName: 'Sam', email: 'sam@example.com' },
};

test('manual e-transfer becomes eligible after the configured delay', () => {
	assert.equal(isManualEtransferReminderDue(order, now, 12), true);
	assert.equal(isManualEtransferReminderDue({ ...order, createdAt: '2026-10-13T09:00:00.000Z' }, now, 12), false);
});

test('manual e-transfer reminder defaults to a two-hour delay', () => {
	assert.equal(isManualEtransferReminderDue({ ...order, createdAt: '2026-10-13T17:59:59.000Z' }, now), true);
	assert.equal(isManualEtransferReminderDue({ ...order, createdAt: '2026-10-13T18:00:01.000Z' }, now), false);
});

test('paid, BluePeak, and already-reminded orders are excluded', () => {
	assert.equal(isManualEtransferReminderDue({ ...order, paymentStatus: 'paid' }, now, 12), false);
	assert.equal(isManualEtransferReminderDue({ ...order, paymentPath: 'bluepeak' }, now, 12), false);
	assert.equal(isManualEtransferReminderDue({ ...order, paymentReminder: { status: 'sent' } }, now, 12), false);
});

test('reminder email contains payment details and already-paid guidance', () => {
	const message = buildManualEtransferReminderEmail(order);
	assert.equal(message.subject, 'Reminder: e-Transfer required for order #PT123');
	assert.match(message.text, /Recipient: orders@puretide\.ca/);
	assert.match(message.text, /BPC-157 Peptide x2 \(\$100\.00\)/);
	assert.match(message.text, /KPV Oral Tablets x1 \(\$10\.00\)/);
	assert.match(message.text, /Subtotal: \$110\.00/);
	assert.match(message.text, /Shipping: \$15\.00/);
	assert.match(message.text, /Amount: \$125\.00 CAD/);
	assert.match(message.text, /Memo\/message: PT123/);
	assert.match(message.text, /Already sent it\? No action is needed/i);
	assert.match(message.text, /Need help or changed your mind\?/i);
	assert.match(message.html, /https:\/\/puretide\.ca\/logo\.png/);
	assert.match(message.html, /alt="Pure Tide"/);
	assert.match(message.html, />BPC-157 Peptide</);
	assert.match(message.html, />\$125\.00 CAD</);
});

test('reminder email escapes product names and promotion codes', () => {
	const message = buildManualEtransferReminderEmail({
		...order,
		promoCode: '<SAVE20>',
		discountAmount: 20,
		cartItems: [{ name: '<script>alert(1)</script>', price: 130, quantity: 1 }],
	});
	assert.doesNotMatch(message.html, /<script>/);
	assert.match(message.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
	assert.match(message.html, /&lt;SAVE20&gt;/);
});
