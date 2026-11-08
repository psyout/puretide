import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('Meta Purchase hashes customer identifiers and returns a sanitized success', async () => {
	process.env.META_CAPI_ENABLED = 'true';
	process.env.META_PIXEL_ID = '123456789012345';
	process.env.META_CAPI_ACCESS_TOKEN = 'private-test-token';
	const { sendMetaPurchase } = await import('../lib/metaConversions');
	let requestBody = '';
	let authorization = '';
	const result = await sendMetaPurchase(
		{
			orderNumber: 'abc123',
			paymentStatus: 'paid',
			paidAt: '2026-11-08T12:00:00.000Z',
			total: 99.5,
			customer: { email: ' Test@Example.com ' },
			metaTracking: { fbp: 'fb.1.123.456', eventSourceUrl: 'https://puretide.ca' },
		},
		(async (_url: string | URL | Request, init?: RequestInit) => {
			requestBody = String(init?.body ?? '');
			authorization = String((init?.headers as Record<string, string>)?.Authorization ?? '');
			return new Response(JSON.stringify({ events_received: 1, fbtrace_id: 'trace-safe' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}) as typeof fetch,
	);
	assert.deepEqual(result, { ok: true, delivered: true, eventsReceived: 1, traceId: 'trace-safe' });
	assert.equal(authorization, 'Bearer private-test-token');
	assert.doesNotMatch(requestBody, /Test@Example\.com|private-test-token/);
	const body = JSON.parse(requestBody);
	assert.equal(body.data[0].event_name, 'Purchase');
	assert.equal(body.data[0].event_id, 'puretide-purchase-abc123');
	assert.equal(body.data[0].custom_data.currency, 'CAD');
});

test('Meta Purchase stays disabled without the server gate', async () => {
	process.env.META_CAPI_ENABLED = 'false';
	const { getMetaPixelId, sendMetaPurchase } = await import('../lib/metaConversions');
	assert.equal(getMetaPixelId(), null);
	const result = await sendMetaPurchase({ orderNumber: 'abc123', paymentStatus: 'paid' });
	assert.deepEqual(result, { ok: false, delivered: false, retryable: false, errorCode: 'META_CAPI_NOT_CONFIGURED' });
});

test('verified payment queues one durable Meta Purchase event', async () => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'puretide-meta-test-'));
	process.env.ORDERS_DB_PATH = path.join(directory, 'orders.sqlite');
	try {
		const {
			claimPaidOrderForFulfillment,
			listPendingMetaPurchases,
			markMetaPurchaseDelivery,
			upsertOrderInDb,
		} = await import('../lib/ordersDb');
		await upsertOrderInDb({
			id: 'order_meta_1',
			orderNumber: 'meta-test-1',
			createdAt: '2026-11-08T12:00:00.000Z',
			paymentStatus: 'pending',
			metaTracking: { enabled: true, purchasePending: false, purchaseDelivered: false },
		});
		const paid = await claimPaidOrderForFulfillment('meta-test-1', {
			paidAt: '2026-11-08T12:05:00.000Z',
			source: 'creditcard_webhook',
		});
		assert.ok(paid);
		assert.equal((await listPendingMetaPurchases()).length, 1);
		await markMetaPurchaseDelivery('meta-test-1', { ok: true });
		assert.equal((await listPendingMetaPurchases()).length, 0);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
