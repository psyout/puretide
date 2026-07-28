import { NextResponse } from 'next/server';
import { getOrderByOrderNumberFromDb, upsertOrderInDb } from '@/lib/ordersDb';
import { runFulfillment, type FulfillmentOrder } from '@/lib/orderFulfillment';
import { validateOrderStateTransition, type OrderPaymentStatus } from '@/lib/orderComputation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function requireOrdersApiKey(request: Request): boolean {
	const key = process.env.ORDERS_API_KEY;
	if (!key) return false;
	const provided =
		request.headers.get('x-api-key') ??
		request.headers
			.get('authorization')
			?.replace(/^Bearer\s+/i, '')
			.trim();
	return provided === key;
}

export async function POST(request: Request, ctx: { params: Promise<{ orderNumber: string }> }) {
	try {
		if (!requireOrdersApiKey(request)) {
			return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
		}

		const { orderNumber } = await ctx.params;
		const normalized = String(orderNumber ?? '').trim();

		const order = await getOrderByOrderNumberFromDb(normalized);
		if (!order) {
			return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
		}

		const currentPaymentStatus = String((order as Record<string, unknown>).paymentStatus ?? '');
		if (currentPaymentStatus === 'paid') {
			return NextResponse.json({ ok: false, error: 'Order is already paid.' }, { status: 400 });
		}

		// Validate state transition
		if (!validateOrderStateTransition(currentPaymentStatus as OrderPaymentStatus, 'paid')) {
			return NextResponse.json({ ok: false, error: 'Invalid state transition.' }, { status: 400 });
		}

		const paidAt = new Date().toISOString();

		// Mark as paid
		await upsertOrderInDb({
			...(order as Record<string, unknown>),
			paymentStatus: 'paid',
			paidAt,
			etransfer: {
				...((order as Record<string, unknown>).etransfer as Record<string, unknown>),
				paidAt,
				status: 'paid',
			},
			fulfillmentStatus: {
				stockUpdated: false,
				emailsSent: false,
				clientSynced: false,
			},
		});

		// Trigger fulfillment
		let fulfillmentFailed = false;
		let emailStatus: unknown;
		let adminEmailStatus: unknown;
		try {
			const result = await runFulfillment(order as unknown as FulfillmentOrder, { paymentConfirmed: true });
			emailStatus = result.emailStatus;
			adminEmailStatus = result.adminEmailStatus;
		} catch (fulfillError) {
			console.error(`Manual fulfillment failed for order ${normalized}:`, fulfillError);
			fulfillmentFailed = true;
		}

		// Update fulfillment status
		const latest = await getOrderByOrderNumberFromDb(normalized);
		if (latest) {
			await upsertOrderInDb({
				...(latest as Record<string, unknown>),
				fulfillmentStatus: fulfillmentFailed
					? {
							stockUpdated: false,
							emailsSent: false,
							clientSynced: false,
							failedAt: new Date().toISOString(),
						}
					: {
							stockUpdated: true,
							emailsSent: Boolean((emailStatus as { sent?: boolean } | undefined)?.sent && (adminEmailStatus as { sent?: boolean } | undefined)?.sent),
							clientSynced: (latest.fulfillmentStatus as { clientSynced?: boolean } | undefined)?.clientSynced ?? false,
						},
				emailStatus: fulfillmentFailed ? (latest as Record<string, unknown>).emailStatus : emailStatus,
				adminEmailStatus: fulfillmentFailed ? (latest as Record<string, unknown>).adminEmailStatus : adminEmailStatus,
			});
		}

		return NextResponse.json({
			ok: true,
			orderNumber: normalized,
			paymentStatus: 'paid',
			paidAt,
			fulfillmentFailed,
			emailStatus,
			adminEmailStatus,
		});
	} catch (error) {
		console.error('Manual fulfillment error:', error);
		return NextResponse.json({ ok: false, error: 'Failed to fulfill order.' }, { status: 500 });
	}
}
