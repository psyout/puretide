import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { listOrdersFromDb } from '@/lib/ordersDb';
import { buildSafeApiError } from '@/lib/apiError';
import { completeFriendsFamilyOrder } from '@/lib/friendsFamilyOrderCompletion';

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

		const result = await completeFriendsFamilyOrder(orderNumber);
		if (!result.ok) {
			return NextResponse.json({ ok: false, error: result.error }, { status: result.error === 'Order not found.' ? 404 : 409 });
		}

		return NextResponse.json({
			ok: true,
			message: `Order #${orderNumber} marked paid. Stock and fulfillment were processed.`,
			alreadyCompleted: result.alreadyCompleted,
			order: result.order,
		});
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to complete order.', error, logLabel: 'dashboard:orders:complete' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
