import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAttributionIntegration } from '../vendor/puretide-order-attribution/index.js';

const secretA = '1'.repeat(64);
const secretB = '2'.repeat(64);
const secretC = '3'.repeat(64);

test('QA attribution keeps placed and verified-paid as separate revisions', async () => {
	let now = 1_800_000_000;
	let order: Record<string, unknown> | null = null;
	let queued: Record<string, unknown> | null = null;
	let revision = 0;
	let historicallyPaid = false;
	const snapshots: Array<Record<string, unknown>> = [];
	const repository = {
		enqueue(input: Record<string, unknown>) {
			const paid = input.paid === true;
			if (revision === 0) revision = 1;
			else if (paid && !historicallyPaid) revision += 1;
			historicallyPaid ||= paid;
			queued = {
				orderRef: input.orderRef,
				environment: input.environment,
				visitId: input.visitId,
				consentPolicy: input.consentPolicy,
				paid: historicallyPaid,
				revision,
			};
			return { status: 'queued', ...queued };
		},
		claimNext() {
			return queued ? { ...queued, leaseToken: 'lease' } : null;
		},
		complete() {
			queued = null;
			return true;
		},
		retry() {},
		cancel() {},
		revoke() {},
	};
	const fetchImpl = async (url: string, init: RequestInit) => {
		const body = JSON.parse(String(init.body)) as Record<string, unknown>;
		if (url.endsWith('/resolve')) {
			return new Response(JSON.stringify({ version: 1, environment: 'qa', eligible: true, visit_id: body.visit_id }));
		}
		snapshots.push(body);
		return new Response(
			JSON.stringify({
				version: 1,
				environment: 'qa',
				order_ref: body.order_ref,
				accepted_revision: body.revision,
				status: 'accepted',
			}),
		);
	};
	const sdk = createAttributionIntegration({
		environment: 'qa',
		enabled: true,
		productionEnabled: false,
		storeOrigin: 'https://puretide.ca',
		collectorBaseUrl: 'https://collector.example/order-attribution/v1',
		publicQueryParameter: 'binom_click_id',
		keyId: 'qa-key',
		collectorSecret: secretA,
		cookieSecret: secretB,
		orderReferenceSecret: secretC,
		consentPolicy: 'qa-test-v1',
		retentionSeconds: 3600,
		repository,
		analyticsConsent: () => true,
		loadOrder: () => order,
		verifyPayment: () => {
			throw new Error('not used');
		},
		fetchImpl,
		now: () => now,
	});

	const capture = await sdk.captureVisit({ requestUrl: 'https://puretide.ca/?binom_click_id=qa-visit', context: {} });
	assert.equal(capture.status, 'captured');
	const cookie = String(capture.setCookie).split(';')[0];
	const extracted = await sdk.extractOrderAttribution({ cookieHeader: cookie, context: {} });
	assert.equal(extracted.status, 'eligible');
	order = {
		id: 'order-1',
		committed: true,
		createdAt: now,
		analyticsAllowed: true,
		attribution: extracted.attribution,
	};

	assert.equal((await sdk.recordOrderPlaced('order-1')).status, 'queued');
	await sdk.flush({ limit: 1 });
	assert.equal(snapshots[0].placed, true);
	assert.equal(snapshots[0].paid, false);

	now += 10;
	assert.equal((await sdk.recordVerifiedPaid({ orderId: 'order-1', provider: 'test', eventId: 'paid-1' })).status, 'queued');
	await sdk.flush({ limit: 1 });
	assert.equal(snapshots[1].paid, true);
	assert.equal(snapshots[1].revision, 2);
});

test('order database persists attribution tasks and repository delivery state', async (t) => {
	const directory = mkdtempSync(join(tmpdir(), 'puretide-attribution-'));
	process.env.ORDERS_DB_PATH = join(directory, 'orders.sqlite');
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const db = await import('../lib/ordersDb');
	await db.upsertOrderInDb({
		id: 'order-db-1',
		orderNumber: 'DB1',
		createdAt: new Date().toISOString(),
		paymentStatus: 'pending',
		analyticsAllowed: true,
		orderAttributionRef: 'a'.repeat(64),
		orderAttribution: { visit_id: 'qa-visit' },
		attributionTracking: { placedPending: true, paidPending: false },
	});
	assert.equal((await db.listPendingAttributionOrders())[0].orderNumber, 'DB1');
	await db.markAttributionTaskDelivered('DB1', 'placed');
	assert.equal((await db.listPendingAttributionOrders()).length, 0);

	await db.upsertOrderInDb({
		...(await db.getOrderBySessionFromDb('order-db-1')),
		paymentStatus: 'paid',
		paidAt: new Date().toISOString(),
	});
	assert.equal((await db.listPendingAttributionOrders())[0].paymentStatus, 'paid');

	const repository = db.createOrdersDbAttributionRepository();
	const enqueued = await repository.enqueue({
		orderRef: 'a'.repeat(64),
		environment: 'qa',
		visitId: 'qa-visit',
		consentPolicy: 'qa-v1',
		paid: false,
		now: 100,
	});
	assert.equal(enqueued.status, 'queued');
	const lease = await repository.claimNext({ environment: 'qa', now: 100, leaseSeconds: 30 });
	assert.ok(lease);
	assert.equal(await repository.complete(lease!), true);
});
