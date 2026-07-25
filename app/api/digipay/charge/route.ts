import { NextResponse } from 'next/server';
import { getPaymentProvider } from '@/lib/paymentProvider';
import { getOrderByOrderNumberFromDb, upsertOrderInDb } from '@/lib/ordersDb';
import { getGatewaylinxConfig, validateEnv } from '@/lib/env';
import { runFulfillment, type FulfillmentOrder } from '@/lib/orderFulfillment';
import { createRetryJobForOrder } from '@/lib/retryJobs';
import { validateOrderStateTransition, type OrderPaymentStatus } from '@/lib/orderComputation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ChargeResult = {
	success?: boolean;
	indeterminate?: boolean;
	redirect?: boolean;
	redirectUrl?: string;
	order_id?: string;
	error?: string;
};

async function markOrderPaidAfterCharge(order: Record<string, unknown>, orderNumber: string, transactionId?: string) {
	if (order.paymentStatus === 'paid') {
		return;
	}
	if (!validateOrderStateTransition(order.paymentStatus as OrderPaymentStatus, 'paid')) {
		return;
	}

	const gatewaylinxConfig = getGatewaylinxConfig();
	const paidAt = new Date().toISOString();

	if (gatewaylinxConfig?.dryRunFulfillment) {
		const existingOrderJson = (order.order_json as Record<string, unknown>) || {};
		await upsertOrderInDb({
			...order,
			paymentStatus: 'paid',
			paidAt,
			order_json: {
				...existingOrderJson,
				gatewaylinx: {
					chargeApprovedAt: paidAt,
					transactionId,
					status: 'approved',
				},
			},
			fulfillmentStatus: {
				stockUpdated: false,
				emailsSent: false,
				clientSynced: false,
				dryRun: true,
			},
		} as Record<string, unknown>);
		return;
	}

	let emailStatus: { sent: boolean; skipped: boolean; error?: string };
	let adminEmailStatus: { sent: boolean; skipped: boolean; error?: string };
	let fulfillmentFailed = false;
	try {
		const fulfillmentResult = await runFulfillment(order as FulfillmentOrder);
		emailStatus = fulfillmentResult.emailStatus;
		adminEmailStatus = fulfillmentResult.adminEmailStatus;
	} catch (fulfillError) {
		console.error(JSON.stringify({ label: 'digipay:charge:fulfillment_failed', orderNumber }));
		console.error(fulfillError);
		fulfillmentFailed = true;
		try {
			await createRetryJobForOrder(orderNumber);
		} catch (retryError) {
			console.error(`[digipay:charge] Failed to create retry job for order ${orderNumber}`, retryError);
		}
		emailStatus = { sent: false, skipped: false, error: 'Fulfillment failed' };
		adminEmailStatus = { sent: false, skipped: false, error: 'Fulfillment failed' };
	}

	await upsertOrderInDb({
		...order,
		paymentStatus: 'paid',
		paidAt,
		fulfillmentStatus: fulfillmentFailed
			? {
					stockUpdated: false,
					emailsSent: false,
					clientSynced: false,
					failedAt: paidAt,
				}
			: {
					stockUpdated: true,
					emailsSent: Boolean(emailStatus?.sent && adminEmailStatus?.sent),
					clientSynced: (order.fulfillmentStatus as { clientSynced?: boolean } | undefined)?.clientSynced ?? false,
				},
		emailStatus,
		adminEmailStatus,
	} as Record<string, unknown>);
}

export async function POST(request: Request) {
	validateEnv();
	try {
		const body = await request.json();
		const { orderNumber, token, reference } = body;

		if (!orderNumber || !token || !reference) {
			return NextResponse.json({ error: 'Missing required fields: orderNumber, token, reference' }, { status: 400 });
		}

		const order = await getOrderByOrderNumberFromDb(orderNumber);
		if (!order) {
			return NextResponse.json({ error: 'Order not found' }, { status: 404 });
		}
		const orderRecord = order as Record<string, unknown>;
		const amount = Number(orderRecord.total ?? 0);
		if (!amount || amount <= 0) {
			return NextResponse.json({ error: 'Invalid order amount' }, { status: 400 });
		}

		const provider = getPaymentProvider();
		if (typeof (provider as { chargePayment?: unknown }).chargePayment !== 'function') {
			return NextResponse.json({ error: 'Charge method not supported by this provider' }, { status: 400 });
		}

		const chargeProvider = provider as unknown as {
			chargePayment: (orderNumber: string, amount: number, token: string, reference: string) => Promise<ChargeResult>;
		};
		const result = await chargeProvider.chargePayment(orderNumber, amount, token, reference);

		if (result.redirect && result.redirectUrl) {
			return NextResponse.json({ success: true, redirect: true, redirectUrl: result.redirectUrl });
		}

		if (result.indeterminate) {
			await upsertOrderInDb({
				...orderRecord,
				paymentStatus: 'pending',
				gatewaylinxCharge: {
					indeterminate: true,
					error: result.error ?? null,
					updatedAt: new Date().toISOString(),
				},
			} as Record<string, unknown>);
			return NextResponse.json({
				success: false,
				indeterminate: true,
				error: result.error ?? 'We could not confirm whether your payment went through. Please do NOT retry — contact support so you are not charged twice.',
			});
		}

		if (result.success) {
			await markOrderPaidAfterCharge(orderRecord, orderNumber, result.order_id);
			return NextResponse.json({ success: true, order_id: result.order_id });
		}

		if (orderRecord.paymentStatus !== 'paid' && validateOrderStateTransition(orderRecord.paymentStatus as OrderPaymentStatus, 'failed')) {
			await upsertOrderInDb({
				...orderRecord,
				paymentStatus: 'failed',
				paymentFailure: {
					reason: 'charge_declined',
					error: result.error ?? null,
					updatedAt: new Date().toISOString(),
				},
			} as Record<string, unknown>);
		}

		return NextResponse.json({ success: false, error: result.error ?? 'Payment was declined.' });
	} catch (error) {
		console.error('Gatewaylinx charge error:', error);
		return NextResponse.json({ error: 'Charge failed', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
	}
}
