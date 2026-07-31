import { getOrderByOrderNumberFromDb, upsertOrderInDb } from '@/lib/ordersDb';
import { runFulfillment, type FulfillmentOrder } from '@/lib/orderFulfillment';

export type ManualEtransferCompletionResult =
	| { ok: true; alreadyCompleted: boolean; order: Record<string, unknown> }
	| { ok: false; error: string };

export function isManualEtransferOrder(order: Pick<FulfillmentOrder, 'paymentMethod' | 'paymentPath'>): boolean {
	return order.paymentMethod === 'etransfer' && (order.paymentPath === 'manual' || order.paymentPath === 'manual_friends_family');
}

export async function completeManualEtransferOrder(orderNumberRaw: string, expectedWrikeTaskId?: string): Promise<ManualEtransferCompletionResult> {
	const orderNumber = String(orderNumberRaw ?? '').trim();
	const order = await getOrderByOrderNumberFromDb(orderNumber);
	if (!order) return { ok: false, error: 'Order not found.' };
	if (!isManualEtransferOrder(order as Pick<FulfillmentOrder, 'paymentMethod' | 'paymentPath'>)) {
		return { ok: false, error: 'Order is not a manual e-Transfer order.' };
	}
	if (expectedWrikeTaskId && order.wrikeTaskId && String(order.wrikeTaskId) !== expectedWrikeTaskId) {
		return { ok: false, error: 'Wrike task does not match this order.' };
	}
	if (order.paymentStatus === 'paid') {
		return { ok: true, alreadyCompleted: true, order };
	}
	if (order.paymentStatus !== 'pending') {
		return { ok: false, error: `Order cannot be completed from status "${String(order.paymentStatus)}".` };
	}

	const priorFulfillment = (order.fulfillmentStatus as Record<string, unknown> | undefined) ?? {};
	if (priorFulfillment.paymentCompletionStartedAt) {
		return { ok: false, error: 'Order completion is already in progress.' };
	}

	const startedAt = new Date().toISOString();
	await upsertOrderInDb({
		...order,
		fulfillmentStatus: {
			...priorFulfillment,
			paymentCompletionStartedAt: startedAt,
		},
	});

	try {
		let emailStatus = order.emailStatus;
		let adminEmailStatus = order.adminEmailStatus;

		// Older orders may already have had stock deducted. Do not do it twice.
		if (priorFulfillment.stockUpdated !== true) {
			const result = await runFulfillment(order as FulfillmentOrder, {
				paymentConfirmed: true,
				skipOrderTask: Boolean(order.wrikeTaskId),
				sendAdminEmail: false,
			});
			emailStatus = result.emailStatus;
		}

		const paidAt = new Date().toISOString();
		const completedOrder = await upsertOrderInDb({
			...order,
			paymentStatus: 'paid',
			paidAt,
			etransfer: {
				...((order.etransfer as Record<string, unknown> | undefined) ?? {}),
				status: 'paid',
				amountReceived: String((order.etransfer as Record<string, unknown> | undefined)?.amountExpected ?? order.total ?? ''),
				paidAt,
			},
			fulfillmentStatus: {
				...priorFulfillment,
				stockUpdated: true,
				emailsSent: Boolean(
					(emailStatus as { sent?: boolean } | undefined)?.sent && (adminEmailStatus as { sent?: boolean } | undefined)?.sent,
				),
				paymentCompletionStartedAt: startedAt,
				completedManuallyAt: paidAt,
			},
			emailStatus,
			adminEmailStatus,
		});

		return { ok: true, alreadyCompleted: false, order: completedOrder };
	} catch (error) {
		await upsertOrderInDb({
			...order,
			fulfillmentStatus: {
				...priorFulfillment,
				paymentCompletionFailedAt: new Date().toISOString(),
				paymentCompletionError: error instanceof Error ? error.message : 'Unknown fulfillment error',
			},
		});
		throw error;
	}
}
