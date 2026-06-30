import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ORDER_NUMBER = process.env.ORDER_NUMBER;
if (!ORDER_NUMBER) {
	console.error('Missing ORDER_NUMBER in environment');
	process.exit(1);
}

const WEBHOOK_SECRET = process.env.BLUEPEAK_WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
	console.error('Missing BLUEPEAK_WEBHOOK_SECRET in environment');
	process.exit(1);
}

if (String(process.env.BLUEPEAK_DRY_RUN_FULFILLMENT ?? '').toLowerCase() !== 'true') {
	console.warn('WARNING: BLUEPEAK_DRY_RUN_FULFILLMENT is not set to true. This script is intended for local dry-run testing.');
}

const baseUrl = process.env.LOCAL_BASE_URL || 'http://localhost:3000';

function toMoneyString(value) {
	if (typeof value === 'string') {
		const n = Number(value);
		if (!Number.isFinite(n)) throw new Error(`Invalid total string: ${value}`);
		return n.toFixed(2);
	}
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) throw new Error('Invalid total number');
		return value.toFixed(2);
	}
	throw new Error('Missing order total');
}

const { getOrderByOrderNumberFromDb } = await import(new URL('../lib/ordersDb.ts', import.meta.url));
const order = await getOrderByOrderNumberFromDb(ORDER_NUMBER);
if (!order) {
	console.error(`Order not found in SQLite: ${ORDER_NUMBER}`);
	process.exit(1);
}

const amount = toMoneyString(order.total);

const EVENT_TYPE = process.env.EVENT_TYPE || 'payment.completed';
const CREATED_AT = process.env.CREATED_AT || new Date().toISOString();
const PAYMENT_STATUS = process.env.PAYMENT_STATUS || 'paid';
const MEMO_MISMATCH = process.env.MEMO_MISMATCH ? process.env.MEMO_MISMATCH === 'true' : null;
const OVERPAID = process.env.OVERPAID ? process.env.OVERPAID === 'true' : false;

const sample = {
	event_id: process.env.EVENT_ID || `evt_${Date.now()}`,
	event_type: EVENT_TYPE,
	created_at: CREATED_AT,
	data: {
		checkout_id: 'co_test',
		reference: ORDER_NUMBER,
		reference_number: process.env.REFERENCE_NUMBER || undefined,
		credit_amount: amount,
		total_credited: amount,
		expected_amount: amount,
		currency: 'CAD',
		status: PAYMENT_STATUS,
		overpaid: OVERPAID,
		memo_mismatch: MEMO_MISMATCH,
		sender_email: 'sender@example.com',
	},
};

const raw = JSON.stringify(sample);
const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw, 'utf8').digest('base64');

const resp = await fetch(`${baseUrl}/api/webhooks/etransfer`, {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		'X-Autodeposit-Signature': sig,
		'X-ADG-Signature': sig,
	},
	body: raw,
});

const text = await resp.text();
console.log('Status:', resp.status);
console.log(text);
