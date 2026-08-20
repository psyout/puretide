import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('only one concurrent credit-card completion can claim fulfillment', async () => {
	const testDirectory = mkdtempSync(path.join(tmpdir(), 'puretide-fulfillment-claim-'));
	process.env.ORDERS_DB_PATH = path.join(testDirectory, 'orders.sqlite');

	try {
		const { claimPaidOrderForFulfillment, getOrderByOrderNumberFromDb, updatePendingOrderIfPending, upsertOrderInDb } = await import('../lib/ordersDb');
		await upsertOrderInDb({
			id: 'order_claim_test',
			orderNumber: 'claim-test-1',
			createdAt: new Date().toISOString(),
			paymentStatus: 'pending',
			total: 42,
		});

		const paidAt = new Date().toISOString();
		const [chargeClaim, webhookClaim] = await Promise.all([
			claimPaidOrderForFulfillment('claim-test-1', {
				paidAt,
				source: 'creditcard_charge',
				transactionId: 'txn-1',
			}),
			claimPaidOrderForFulfillment('claim-test-1', {
				paidAt,
				source: 'creditcard_webhook',
				transactionId: 'txn-1',
				amountReceived: 42,
			}),
		]);

		assert.equal([chargeClaim, webhookClaim].filter(Boolean).length, 1);
		const staleFailure = await updatePendingOrderIfPending('claim-test-1', {
			paymentStatus: 'failed',
			paymentFailure: { reason: 'stale_charge_response' },
		});
		assert.equal(staleFailure, null);
		const storedOrder = await getOrderByOrderNumberFromDb('claim-test-1');
		assert.equal(storedOrder?.paymentStatus, 'paid');
		assert.equal((storedOrder?.paymentCompletion as { transactionId?: string })?.transactionId, 'txn-1');
	} finally {
		rmSync(testDirectory, { recursive: true, force: true });
	}
});
