import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAffiliateOrderSources, parseWrikeAffiliateOrder } from '../lib/wrikeAffiliateOrders';

test('parses a historical affiliate conversion from a Wrike order task', () => {
	const order = parseWrikeAffiliateOrder({
		id: 'task-1',
		title: 'Order #c1eff8ea4d - Example Customer',
		createdDate: '2026-09-29T19:04:30Z',
		description: `
			<h3>AWAITING PAYMENT · Order #c1eff8ea4d</h3>
			<p>Subtotal: $341.98<br>
			Discount (THEBESTYOU): -$34.20<br>
			<b>Total: $307.78</b></p>
		`,
	});

	assert.deepEqual(order, {
		id: 'wrike_task-1',
		orderNumber: 'c1eff8ea4d',
		createdAt: '2026-09-29T19:04:30Z',
		paymentStatus: 'pending',
		promoCode: 'THEBESTYOU',
		subtotal: 341.98,
		discountAmount: 34.2,
		total: 307.78,
		customer: { firstName: 'Example Customer', lastName: '' },
		orderSource: 'wrike',
	});
});

test('database status wins while Wrike fills a missing historical promo code', () => {
	const merged = mergeAffiliateOrderSources(
		[{ orderNumber: 'ORDER-1', paymentStatus: 'paid', subtotal: 100, total: 90 }],
		[{ orderNumber: 'ORDER-1', paymentStatus: 'pending', promoCode: 'PUREBOYES', subtotal: 100, discountAmount: 10, total: 90 }],
	);

	assert.equal(merged.length, 1);
	assert.equal(merged[0]?.paymentStatus, 'paid');
	assert.equal(merged[0]?.promoCode, 'PUREBOYES');
	assert.equal(merged[0]?.discountAmount, 10);
});

test('does not treat Wrike task completion as payment confirmation', () => {
	const order = parseWrikeAffiliateOrder({
		id: 'task-completed',
		title: 'Order #c1eff8ea4d - Example Customer',
		createdDate: '2026-09-29T19:04:30Z',
		completedDate: '2026-10-01T15:23:26Z',
		status: 'Completed',
		description: `
			<h3>AWAITING PAYMENT · Order #c1eff8ea4d</h3>
			<p>Subtotal: $341.98<br>
			Discount (THEBESTYOU): -$34.20<br>
			<b>Total: $307.78</b></p>
		`,
	});

	assert.equal(order?.paymentStatus, 'pending');
});

test('treats an e-transfer as paid when the Wrike payment field is Transferred', () => {
	const order = parseWrikeAffiliateOrder(
		{
			id: 'task-transferred',
			title: 'Order #c1eff8ea4d - Example Customer',
			createdDate: '2026-09-29T19:04:30Z',
			status: 'Active',
			customFields: [{ id: 'payment-field', value: 'Transferred' }],
			description: `
				<h3>AWAITING PAYMENT · Order #c1eff8ea4d</h3>
				<p>Subtotal: $341.98<br>
				Discount (THEBESTYOU): -$34.20<br>
				<b>Total: $307.78</b></p>
			`,
		},
		'payment-field',
	);

	assert.equal(order?.paymentStatus, 'paid');
});
