import { NextResponse } from 'next/server';
import { readSheetPromoCodes } from '@/lib/stockSheet';
import { checkRateLimit } from '@/lib/rateLimit';
import { getPromoMinimumSubtotalError, getPromoProductEligibilityError } from '@/lib/promo';

const PROMO_VERIFY_RATE_LIMIT = 20;
const PROMO_VERIFY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
	try {
		const { allowed } = checkRateLimit(request, 'promo-verify', PROMO_VERIFY_RATE_LIMIT, PROMO_VERIFY_WINDOW_MS);
		if (!allowed) {
			return NextResponse.json({ ok: false, error: 'Too many attempts. Please try again later.' }, { status: 429 });
		}

		const body = (await request.json()) as {
			code?: unknown;
			subtotal?: unknown;
			cartItems?: Array<{ id?: unknown; price?: unknown; quantity?: unknown }>;
		};
		const code = typeof body?.code === 'string' ? body.code : String(body?.code ?? '').trim();
		if (!code.trim()) {
			return NextResponse.json({ ok: false, error: 'Code is required' }, { status: 400 });
		}
		const subtotal = typeof body?.subtotal === 'number' ? body.subtotal : Number(body?.subtotal);
		const normalizedSubtotal = Number.isFinite(subtotal) && subtotal >= 0 ? subtotal : 0;

		const normalizedCode = code.trim().toUpperCase();
		const promoCodes = await readSheetPromoCodes();

		if (promoCodes.length === 0) {
			// This could mean either no codes exist or the sheet is missing
			return NextResponse.json({ ok: false, error: 'Promo sheet is empty. Please add a code row after the header.' }, { status: 404 });
		}

		const promo = promoCodes.find((p) => p.code === normalizedCode && p.active);

		if (!promo) {
			return NextResponse.json({ ok: false, error: 'Invalid or expired promo code' }, { status: 404 });
		}

		const minimumError = getPromoMinimumSubtotalError({ promo, subtotal: normalizedSubtotal });
		if (minimumError) {
			return NextResponse.json({ ok: false, error: minimumError }, { status: 400 });
		}
		const requestedItems = Array.isArray(body.cartItems)
			? body.cartItems
					.map((item) => ({ id: String(item.id ?? ''), price: Number(item.price), quantity: Number(item.quantity) }))
					.filter((item) => item.id && Number.isFinite(item.price) && item.price >= 0 && Number.isFinite(item.quantity) && item.quantity > 0)
			: [];
		const eligibilityError = requestedItems.length > 0 ? getPromoProductEligibilityError(promo, requestedItems) : null;
		if (eligibilityError) {
			return NextResponse.json({ ok: false, error: eligibilityError }, { status: 400 });
		}

		return NextResponse.json({
			ok: true,
			discount: promo.discount,
			freeShipping: Boolean(promo.freeShipping),
			productIds: promo.productIds ?? [],
		});
	} catch (error) {
		console.error('Promo verification error:', error);
		return NextResponse.json({ ok: false, error: 'Something went wrong. Please try again later.' }, { status: 500 });
	}
}
