import { NextRequest, NextResponse } from 'next/server';
import { listOrdersFromDb } from '@/lib/ordersDb';
import { reconcileCardPayment } from '@/lib/cardPaymentsReconciliation';
import { CardPaymentsApiError } from '@/lib/cardPaymentsApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
	const secret = process.env.CRON_SECRET;
	if (!secret || request.headers.get('x-cron-secret') !== secret) {
		return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}
	const now = Date.now();
	const due = (await listOrdersFromDb()).filter((order) => {
		if (order.paymentProvider !== 'gatewaylinx_api' || order.paymentStatus !== 'pending') return false;
		const card = order.cardPayments as { final?: boolean; nextCheckAt?: string | null } | undefined;
		return card?.final !== true && (!card?.nextCheckAt || Date.parse(card.nextCheckAt) <= now);
	}).slice(0, 10);
	let checked = 0;
	for (const order of due) {
		try {
			await reconcileCardPayment(String(order.orderNumber));
			checked++;
		} catch (error) {
			console.error(JSON.stringify({ label: 'card_payments:cron_failed', orderNumber: order.orderNumber }));
			if (error instanceof CardPaymentsApiError && error.status === 429) break;
		}
	}
	return NextResponse.json({ ok: true, checked });
}
