import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { getOrderByOrderNumberFromDb, listOrdersFromDb, upsertOrderInDb } from '@/lib/ordersDb';
import { runFulfillment, type FulfillmentOrder } from '@/lib/orderFulfillment';
import { buildSafeApiError } from '@/lib/apiError';

export async function GET(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const orders = await listOrdersFromDb();
		const sorted = [...orders].sort((a, b) => {
			const aT = String(a.createdAt ?? '');
			const bT = String(b.createdAt ?? '');
			return bT.localeCompare(aT);
		});
		return NextResponse.json({ ok: true, orders: sorted });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to read orders';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}

type CompleteOrderBody = {
	orderNumber?: string;
};

export async function POST(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;

	try {
		const body = (await request.json()) as CompleteOrderBody;
		const orderNumber = String(body.orderNumber ?? '').trim();
		if (!orderNumber) {
			return NextResponse.json({ ok: false, error: 'Order number is required.' }, { status: 400 });
		}

		const order = await getOrderByOrderNumberFromDb(orderNumber);
		if (!order) {
			return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
		}
		if (order.paymentMethod !== 'etransfer' || order.paymentPath !== 'manual_friends_family') {
			return NextResponse.json({ ok: false, error: 'Only Friends & Family e-Transfer orders can be completed manually.' }, { status: 400 });
		}
		if (order.paymentStatus === 'paid') {
			return NextResponse.json({ ok: true, alreadyCompleted: true, order });
		}
		if (order.paymentStatus !== 'pending') {
			return NextResponse.json({ ok: false, error: `This order cannot be completed from status "${String(order.paymentStatus)}".` }, { status: 409 });
		}

		const paidAt = new Date().toISOString();
		const priorFulfillment = (order.fulfillmentStatus as Record<string, unknown> | undefined) ?? {};
		let emailStatus = order.emailStatus;
		let adminEmailStatus = order.adminEmailStatus;

		// Older Friends & Family orders may already have been fulfilled at checkout.
		// Never decrement their stock a second time.
		if (priorFulfillment.stockUpdated !== true) {
			const result = await runFulfillment(order as FulfillmentOrder, { paymentConfirmed: true });
			emailStatus = result.emailStatus;
			adminEmailStatus = result.adminEmailStatus;
		}

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
				completedManuallyAt: paidAt,
			},
			emailStatus,
			adminEmailStatus,
		});

		return NextResponse.json({
			ok: true,
			message: `Order #${orderNumber} marked paid. Stock and fulfillment were processed.`,
			order: completedOrder,
		});
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to complete order.', error, logLabel: 'dashboard:orders:complete' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
