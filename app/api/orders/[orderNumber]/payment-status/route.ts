import { NextResponse } from 'next/server';
import { getOrderByOrderNumberFromDb } from '@/lib/ordersDb';
import { verifyOrderConfirmationToken } from '@/lib/orderConfirmationToken';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request, ctx: { params: Promise<{ orderNumber: string }> }) {
	const { orderNumber } = await ctx.params;
	const url = new URL(request.url);
	const token = url.searchParams.get('token') ?? '';
	const normalized = String(orderNumber ?? '').trim();

	if (!normalized || !verifyOrderConfirmationToken(normalized, token.trim())) {
		return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}

	const order = await getOrderByOrderNumberFromDb(normalized);
	if (!order) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });

	const paymentStatus = String((order as Record<string, unknown>).paymentStatus ?? '');
	const etransfer = (order as Record<string, unknown>).etransfer as Record<string, unknown> | undefined;

	return NextResponse.json({
		ok: true,
		orderNumber: normalized,
		paymentStatus,
		etransfer: etransfer
			? {
				provider: etransfer.provider ?? null,
				status: etransfer.status ?? null,
				amountExpected: etransfer.amountExpected ?? null,
				amountReceived: etransfer.amountReceived ?? null,
				overpaid: etransfer.overpaid ?? null,
				paidAt: etransfer.paidAt ?? null,
			}
			: null,
	});
}
