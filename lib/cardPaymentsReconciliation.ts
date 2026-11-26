import { CardPaymentsApiError, getCardPaymentByReference, type CardPayment } from './cardPaymentsApi';
import { claimPaidOrderForFulfillment, getOrderByOrderNumberFromDb, updatePendingOrderIfPending, upsertOrderInDb, type StoredOrder } from './ordersDb';
import { runFulfillment, type FulfillmentOrder } from './orderFulfillment';
import { createRetryJobForOrder } from './retryJobs';
import { decideCardPayment } from './cardPaymentOutcome';

type PaymentTracking = {
	id?: string;
	environment?: 'test' | 'live';
	outcome?: string;
	final?: boolean;
	nextCheckAt?: string | null;
	lastCheckedAt?: string;
	returnReadAt?: string;
	manualReview?: string;
};

function tracking(order: StoredOrder): PaymentTracking {
	return (order.cardPayments as PaymentTracking | undefined) ?? {};
}

function nextCheckAt(payment: CardPayment): string | null {
	return payment.final ? null : new Date(Date.now() + Math.max(60, payment.poll_after_seconds ?? 300) * 1000).toISOString();
}

async function updateTracking(orderNumber: string, order: StoredOrder, changes: Partial<PaymentTracking>): Promise<void> {
	await updatePendingOrderIfPending(orderNumber, { cardPayments: { ...tracking(order), ...changes } });
}

/** The browser return is untrusted; only the authenticated gateway read can complete an order. */
export async function reconcileCardPayment(orderNumber: string, onReturn = false): Promise<StoredOrder | null> {
	const order = await getOrderByOrderNumberFromDb(orderNumber);
	if (!order || order.paymentProvider !== 'gatewaylinx_api' || order.paymentStatus !== 'pending') return order;
	const previous = tracking(order);
	if (previous.final === true) return order;
	if (onReturn && previous.returnReadAt) return order;
	if (!onReturn && previous.nextCheckAt && Date.now() < Date.parse(previous.nextCheckAt)) return order;

	let payment: CardPayment;
	try {
		payment = await getCardPaymentByReference(orderNumber);
	} catch (error) {
		const delay = error instanceof CardPaymentsApiError && error.status === 429
			? Math.max(60, error.retryAfterSeconds ?? 60)
			: 60;
		await updateTracking(orderNumber, order, { nextCheckAt: new Date(Date.now() + delay * 1000).toISOString() });
		if (error instanceof CardPaymentsApiError && error.status === 429) throw error;
		if (!(error instanceof CardPaymentsApiError && error.status === 404)) {
			console.error(JSON.stringify({ label: 'card_payments:read_failed', orderNumber, status: error instanceof CardPaymentsApiError ? error.status : undefined }));
		}
		return order;
	}

	const now = new Date().toISOString();
	const paymentState: PaymentTracking = {
		...previous,
		id: payment.id,
		outcome: payment.outcome,
		final: payment.final,
		lastCheckedAt: now,
		nextCheckAt: nextCheckAt(payment),
		...(onReturn ? { returnReadAt: now } : {}),
	};
	const expectedMinor = Math.round(Number(order.total) * 100);
	const decision = decideCardPayment(payment, orderNumber, expectedMinor);
	if (decision === 'review' && (payment.reference !== orderNumber || payment.amount?.amount_minor !== expectedMinor || payment.amount?.currency !== 'CAD' || payment.amount_matches === false)) {
		const manualReview = 'payment_amount_or_reference_mismatch';
		console.error(JSON.stringify({ label: 'card_payments:manual_review', orderNumber, paymentId: payment.id, reason: manualReview }));
		await updateTracking(orderNumber, order, { ...paymentState, manualReview });
		return getOrderByOrderNumberFromDb(orderNumber);
	}

	if (decision === 'paid') {
		const claimed = await claimPaidOrderForFulfillment(orderNumber, {
			paidAt: now,
			source: 'card_payments_api',
			transactionId: payment.id,
			amountReceived: expectedMinor / 100,
		});
		if (!claimed) return getOrderByOrderNumberFromDb(orderNumber);
		try {
			const result = await runFulfillment(claimed as FulfillmentOrder);
			await upsertOrderInDb({
				...claimed,
				cardPayments: paymentState,
				fulfillmentStatus: {
					stockUpdated: true,
					emailsSent: Boolean(result.emailStatus.sent && result.adminEmailStatus.sent),
					clientSynced: (claimed.fulfillmentStatus as { clientSynced?: boolean } | undefined)?.clientSynced ?? false,
				},
				emailStatus: result.emailStatus,
				adminEmailStatus: result.adminEmailStatus,
			});
		} catch (error) {
			console.error(JSON.stringify({ label: 'card_payments:fulfillment_failed', orderNumber, paymentId: payment.id }));
			try { await createRetryJobForOrder(orderNumber); } catch (retryError) {
				console.error(JSON.stringify({ label: 'card_payments:retry_job_failed', orderNumber }));
			}
			await upsertOrderInDb({ ...claimed, cardPayments: paymentState, fulfillmentStatus: { failedAt: now, stockUpdated: false, emailsSent: false, clientSynced: false } });
		}
		return getOrderByOrderNumberFromDb(orderNumber);
	}

	if (decision === 'failed') {
		await updatePendingOrderIfPending(orderNumber, {
			paymentStatus: 'failed',
			cardPayments: paymentState,
			paymentFailure: { reason: 'gateway_final_failed', providerStatus: payment.status, updatedAt: now },
		});
		return getOrderByOrderNumberFromDb(orderNumber);
	}

	if (decision === 'review') {
		paymentState.manualReview = payment.final ? 'gateway_needs_attention' : undefined;
	}
	await updateTracking(orderNumber, order, paymentState);
	return getOrderByOrderNumberFromDb(orderNumber);
}
