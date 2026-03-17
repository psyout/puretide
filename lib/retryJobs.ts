import { RetryJob, getPendingRetryJobs, upsertRetryJobInDb } from './ordersDb';
import { runFulfillment, type FulfillmentOrder } from './orderFulfillment';
import { getOrderBySessionFromDb, upsertOrderInDb } from './ordersDb';
import { buildSafeApiError } from './apiError';

const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 3 * 60 * 60_000]; // 1m, 5m, 15m, 1h, 3h

export async function processRetryJobs(): Promise<void> {
	const jobs = await getPendingRetryJobs();
	if (jobs.length === 0) return;

	console.log(`[retry-jobs] Processing ${jobs.length} pending jobs`);

	for (const job of jobs) {
		try {
			const order = await getOrderBySessionFromDb(job.session);
			if (!order) {
				console.warn(`[retry-jobs] Order not found for session ${job.session}, marking job completed`);
				await upsertRetryJobInDb({
					...job,
					status: 'completed',
					updatedAt: new Date().toISOString(),
				});
				continue;
			}

			// Only retry fulfillment for paid orders
			if (order.paymentStatus !== 'paid') {
				console.warn(`[retry-jobs] Order ${job.session} not paid (status: ${order.paymentStatus}), skipping`);
				await upsertRetryJobInDb({
					...job,
					status: 'completed',
					updatedAt: new Date().toISOString(),
				});
				continue;
			}

			await runFulfillment(order as FulfillmentOrder);

			// Mark job as completed on successful fulfillment
			await upsertRetryJobInDb({
				...job,
				status: 'completed',
				updatedAt: new Date().toISOString(),
			});

			console.log(`[retry-jobs] Successfully processed retry job for session ${job.session}`);
		} catch (error) {
			const safe = buildSafeApiError({ defaultMessage: 'Retry job failed', error, logLabel: 'retry-jobs' });
			console.error(`[retry-jobs] Job ${job.id} failed: ${safe.errorId}`, error);

			const nextAttempt = job.attempts + 1;
			if (nextAttempt > MAX_ATTEMPTS) {
				// Max attempts reached, mark as failed
				await upsertRetryJobInDb({
					...job,
					status: 'failed',
					attempts: nextAttempt,
					updatedAt: new Date().toISOString(),
					lastError: safe.message,
				});
				console.error(`[retry-jobs] Max attempts exceeded for job ${job.id}, marking as failed`);
			} else {
				// Schedule next attempt
				const delayMs = RETRY_DELAYS_MS[Math.min(nextAttempt - 1, RETRY_DELAYS_MS.length - 1)];
				const nextRunAt = new Date(Date.now() + delayMs).toISOString();
				await upsertRetryJobInDb({
					...job,
					attempts: nextAttempt,
					nextRunAt,
					updatedAt: new Date().toISOString(),
					lastError: safe.message,
				});
				console.log(`[retry-jobs] Scheduled next attempt for job ${job.id} at ${nextRunAt}`);
			}
		}
	}
}

export async function createRetryJobForOrder(session: string): Promise<void> {
	const now = new Date().toISOString();
	await upsertRetryJobInDb({
		id: `retry-${session}-${Date.now()}`,
		session,
		attempts: 0,
		nextRunAt: now,
		createdAt: now,
		updatedAt: now,
		status: 'pending',
	});
}
