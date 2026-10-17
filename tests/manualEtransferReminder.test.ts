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
	total: 125,
	customer: { firstName: 'Sam', email: 'sam@example.com' },
};

test('manual e-transfer becomes eligible after the configured delay', () => {
	assert.equal(isManualEtransferReminderDue(order, now, 12), true);
	assert.equal(isManualEtransferReminderDue({ ...order, createdAt: '2026-10-13T09:00:00.000Z' }, now, 12), false);
});

test('manual e-transfer reminder defaults to a one-hour delay', () => {
	assert.equal(isManualEtransferReminderDue({ ...order, createdAt: '2026-10-13T18:59:59.000Z' }, now), true);
	assert.equal(isManualEtransferReminderDue({ ...order, createdAt: '2026-10-13T19:00:01.000Z' }, now), false);
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
	assert.match(message.text, /Amount: \$125\.00/);
	assert.match(message.text, /Memo\/message: PT123/);
	assert.match(message.text, /Already sent it\? No action is needed/i);
	assert.match(message.text, /Changed your mind\? That's completely okay/i);
	assert.match(message.text, /simply reply to this email/i);
	assert.match(message.html, /https:\/\/puretide\.ca\/logo\.png/);
	assert.match(message.html, /alt="Pure Tide"/);
});
