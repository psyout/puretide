import { NextRequest, NextResponse } from 'next/server';
import { listPendingMetaPurchases, markMetaPurchaseDelivery } from '@/lib/ordersDb';
import { sendMetaPurchase } from '@/lib/metaConversions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
	const expected = process.env.CRON_SECRET;
	if (!expected || request.headers.get('x-cron-secret') !== expected) {
		return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}

	const orders = await listPendingMetaPurchases(50);
	let delivered = 0;
	let retried = 0;
	const errorCodes: string[] = [];
	for (const order of orders) {
		const result = await sendMetaPurchase(order);
		await markMetaPurchaseDelivery(String(order.orderNumber ?? ''), result);
		if (result.ok) delivered += 1;
		else {
			retried += 1;
			errorCodes.push(result.errorCode);
		}
	}

	return NextResponse.json({ ok: true, status: 'processed', delivered, retried, errorCodes: Array.from(new Set(errorCodes)) });
}
