import { NextResponse } from 'next/server';
import { getOrderByOrderNumberFromDb, upsertOrderInDb } from '@/lib/ordersDb';
import { bluepeakCreateCheckout } from '@/lib/bluepeak';
import { buildSafeApiError } from '@/lib/apiError';
import { BluepeakApiError } from '@/lib/bluepeak';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = {
	orderNumber: string;
	idempotencyKey?: string;
};

export async function POST(request: Request) {
	try {
		const etransferProviderRaw = String(process.env.ETRANSFER_PROVIDER ?? 'manual');
		const etransferProvider = etransferProviderRaw.toLowerCase() === 'bluepeak' ? 'bluepeak' : 'manual';
		if (etransferProvider !== 'bluepeak') {
			console.warn(JSON.stringify({ label: 'bluepeak:create:disabled', etransferProviderRaw }));
			return NextResponse.json({ ok: false, error: 'BluePeak e-Transfer is disabled.' }, { status: 503 });
		}

		const secret = process.env.BLUEPEAK_SECRET_KEY;
		if (!secret) {
			return NextResponse.json({ ok: false, error: 'BluePeak not configured (missing BLUEPEAK_SECRET_KEY)' }, { status: 500 });
		}

		const body = (await request.json()) as Body;
		const orderNumber = String(body.orderNumber ?? '').trim();
		if (!orderNumber) return NextResponse.json({ ok: false, error: 'Missing orderNumber.' }, { status: 400 });

		console.info(
			JSON.stringify({
				label: 'bluepeak:create:request',
				orderNumber,
				etransferProviderRaw,
				hasIdempotencyKey: Boolean(String(body.idempotencyKey ?? '').trim()),
			}),
		);

		const order = await getOrderByOrderNumberFromDb(orderNumber);
		if (!order) return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });

		const paymentMethod = (order as Record<string, unknown>).paymentMethod;
		if (paymentMethod !== 'etransfer') {
			return NextResponse.json({ ok: false, error: 'Order is not an e-transfer order.' }, { status: 400 });
		}

		if (String((order as Record<string, unknown>).paymentStatus ?? '') === 'paid') {
			return NextResponse.json({ ok: true, alreadyPaid: true }, { status: 200 });
		}

		const et = (order as Record<string, unknown>).etransfer as Record<string, unknown> | undefined;
		const existingCheckoutId = typeof et?.checkoutId === 'string' ? et.checkoutId : '';
		const existingDepositEmail = typeof et?.depositEmail === 'string' ? et.depositEmail : '';

		// If we already have deposit instructions, return them.
		if (existingCheckoutId && existingDepositEmail) {
			return NextResponse.json({
				ok: true,
				checkoutId: existingCheckoutId,
				depositEmail: existingDepositEmail,
				recipientName: typeof et?.recipientName === 'string' ? et.recipientName : null,
				memo: typeof et?.paymentReference === 'string' ? et.paymentReference : orderNumber,
				amountExpected: typeof et?.amountExpected === 'string' ? et.amountExpected : null,
				currency: typeof et?.currency === 'string' ? et.currency : 'CAD',
				clientToken: typeof et?.clientToken === 'string' ? et.clientToken : null,
			});
		}

		const customer = (order as Record<string, unknown>).customer as Record<string, unknown> | undefined;
		const firstName = String(customer?.firstName ?? '').trim();
		const lastName = String(customer?.lastName ?? '').trim();
		const email = String(customer?.email ?? '')
			.trim()
			.toLowerCase();

		if (!firstName || !lastName || !email) {
			return NextResponse.json({ ok: false, error: 'Order is missing customer details.' }, { status: 400 });
		}

		const amountExpected = String(et?.amountExpected ?? '').trim();
		if (!amountExpected) {
			return NextResponse.json({ ok: false, error: 'Order is missing amountExpected.' }, { status: 400 });
		}

		const idempotencyKey = String(body.idempotencyKey ?? `etransfer-${orderNumber}`)
			.trim()
			.slice(0, 64);

		const checkout = await bluepeakCreateCheckout({
			amount: amountExpected,
			reference: orderNumber,
			customer: { first_name: firstName, last_name: lastName, email },
			idempotencyKey,
		});

		const updated = {
			...(order as Record<string, unknown>),
			paymentProvider: 'bluepeak',
			etransfer: {
				...(et ?? {}),
				provider: 'bluepeak',
				status: checkout.status,
				checkoutId: checkout.checkout_id,
				depositEmail: checkout.deposit_email,
				recipientName: checkout.recipient_name ?? null,
				currency: checkout.currency,
				amountExpected: checkout.amount,
				amountReceived: checkout.total_credited,
				paymentReference: checkout.reference,
				overpaid: checkout.overpaid,
				memoMismatch: checkout.memo_mismatch ?? null,
				clientToken: checkout.client_token,
				paidAt: null,
				lastEventAt: checkout.created_at,
			},
		};

		await upsertOrderInDb(updated);

		return NextResponse.json({
			ok: true,
			checkoutId: checkout.checkout_id,
			depositEmail: checkout.deposit_email,
			recipientName: checkout.recipient_name ?? null,
			memo: checkout.memo,
			amountExpected: checkout.amount,
			currency: checkout.currency,
			clientToken: checkout.client_token,
			status: checkout.status,
		});
	} catch (error) {
		if (error instanceof BluepeakApiError) {
			const snippet = error.body.length > 800 ? `${error.body.slice(0, 800)}…` : error.body;
			console.error(
				JSON.stringify({
					label: 'bluepeak:create:upstream_error',
					status: error.status,
					bodySnippet: snippet,
				}),
			);
			return NextResponse.json(
				{
					ok: false,
					error: `BluePeak error (${error.status}).`,
					upstreamStatus: error.status,
					upstreamBody: process.env.NODE_ENV === 'production' ? undefined : snippet,
				},
				{ status: 502 },
			);
		}

		const safe = buildSafeApiError({ defaultMessage: 'Failed to create e-transfer payment.', error, logLabel: 'bluepeak:create' });
		console.error(JSON.stringify({ label: 'bluepeak:create:error', errorId: safe.errorId }));
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
