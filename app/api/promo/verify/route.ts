import { NextResponse } from 'next/server';
import { readSheetPromoCodes } from '@/lib/stockSheet';
import { checkRateLimit } from '@/lib/rateLimit';
import { getPromoMinimumSubtotalError } from '@/lib/promo';

const PROMO_VERIFY_RATE_LIMIT = 20;
const PROMO_VERIFY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
	try {
		const { allowed } = checkRateLimit(request, 'promo-verify', PROMO_VERIFY_RATE_LIMIT, PROMO_VERIFY_WINDOW_MS);
		if (!allowed) {
			return NextResponse.json({ ok: false, error: 'Too many attempts. Please try again later.' }, { status: 429 });
		}

		const body = (await request.json()) as { code?: unknown; subtotal?: unknown };
		const code = typeof body?.code === 'string' ? body.code : String(body?.code ?? '').trim();
		if (!code.trim()) {
			return NextResponse.json({ ok: false, error: 'Code is required' }, { status: 400 });
		}
		const subtotal = typeof body?.subtotal === 'number' ? body.subtotal : Number(body?.subtotal);
		const normalizedSubtotal = Number.isFinite(subtotal) && subtotal >= 0 ? subtotal : 0;

		const normalizedCode = code.trim().toUpperCase();
		const promoCodes = await readSheetPromoCodes();
		console.log('[DEBUG] Promo verification:', {
			normalizedCode,
			promoCodesCount: promoCodes.length,
			allCodes: promoCodes.map((p) => ({ code: p.code, active: p.active, discount: p.discount })),
		});

		if (promoCodes.length === 0) {
			// This could mean either no codes exist or the sheet is missing
			return NextResponse.json({ ok: false, error: 'Promo sheet is empty. Please add a code row after the header.' }, { status: 404 });
		}

		const promo = promoCodes.find((p) => p.code === normalizedCode && p.active);
		console.log('[DEBUG] Found promo:', promo ? { code: promo.code, active: promo.active, discount: promo.discount } : 'Not found');

		if (!promo) {
			return NextResponse.json({ ok: false, error: 'Invalid or expired promo code' }, { status: 404 });
		}

		const minimumError = getPromoMinimumSubtotalError({ promo, subtotal: normalizedSubtotal });
		if (minimumError) {
			return NextResponse.json({ ok: false, error: minimumError }, { status: 400 });
		}

		return NextResponse.json({ ok: true, discount: promo.discount, freeShipping: Boolean(promo.freeShipping) });
	} catch (error) {
		console.error('Promo verification error:', error);
		return NextResponse.json({ ok: false, error: 'Something went wrong. Please try again later.' }, { status: 500 });
	}
}
