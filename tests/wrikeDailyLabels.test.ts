import assert from 'node:assert/strict';
import test from 'node:test';
import { getDailyLabelWindow, getWrikeTaskBusinessDate, parseLabelFromOrderDescription } from '@/lib/wrikeDailyLabels';

test('morning label window runs from 6 AM to 6 AM in Vancouver', () => {
	const { start, end } = getDailyLabelWindow(new Date(2026, 7, 10));
	assert.equal(start.toISOString(), '2026-08-10T13:00:00.000Z');
	assert.equal(end.toISOString(), '2026-08-11T13:00:00.000Z');
});

test('morning label window remains Vancouver-local across daylight-saving changes', () => {
	const { start, end } = getDailyLabelWindow(new Date(2026, 10, 1));
	assert.equal(start.toISOString(), '2026-11-01T14:00:00.000Z');
	assert.equal(end.toISOString(), '2026-11-02T14:00:00.000Z');
});

test('assigns late-evening UTC orders to their Vancouver business date', () => {
	assert.equal(
		getWrikeTaskBusinessDate({
			createdDate: '2026-08-05T02:12:50Z',
			description: '<b>Date:</b> 2026-08-05, 3:12:45 a.m.<br>',
		}),
		'2026-08-04',
	);
});

test('parses current Wrike-normalized shipping section without a separate Name field', () => {
	const description = [
		'<h3>PAID · Order #123</h3><br>',
		'<b>Date:</b> 2026-08-03, 8:12:00 a.m.<br>',
		'<h4>Shipping Address</h4><br>',
		'<b>🚚 SHIP TO:</b><br>',
		'Jane Example<br>',
		'12-345 Main Street<br>',
		'Vancouver, BC V6B 1A1<br>',
		'Canada<br>',
		'<h4>Customer Contact</h4><br>',
		'<b>✉️ Email:</b> jane@example.test<br>',
	].join('');

	assert.deepEqual(parseLabelFromOrderDescription(description), {
		name: 'Jane Example',
		lines: ['12-345 Main Street', 'Vancouver, BC', 'V6B 1A1', 'Canada'],
	});
});

test('continues to parse legacy Wrike descriptions with an explicit Name field', () => {
	const description = [
		'<b>👤 Name:</b> John Example<br>',
		'<h4>Shipping Address</h4><br>',
		'<b>🚚 SHIP TO:</b><br>',
		'99 Legacy Road<br>',
		'Victoria, BC V8V 1A1<br>',
		'<h4>Order Items</h4>',
	].join('');

	assert.deepEqual(parseLabelFromOrderDescription(description), {
		name: 'John Example',
		lines: ['99 Legacy Road', 'Victoria, BC', 'V8V 1A1'],
	});
});
