import { NextResponse } from 'next/server';
import { readSheetPromoCodes } from '@/lib/stockSheet';
import { checkRateLimit } from '@/lib/rateLimit';

const PROMO_VERIFY_RATE_LIMIT = 20;
const PROMO_VERIFY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
	try {
		const { allowed } = checkRateLimit(request, 'promo-verify', PROMO_VERIFY_RATE_LIMIT, PROMO_VERIFY_WINDOW_MS);
		if (!allowed) {
			return NextResponse.json({ ok: false, error: 'Too many attempts. Please try again later.' }, { status: 429 });
		}

		const body = (await request.json()) as { code?: unknown };
		const code = typeof body?.code === 'string' ? body.code : String(body?.code ?? '').trim();
		if (!code.trim()) {
			return NextResponse.json({ ok: false, error: 'Code is required' }, { status: 400 });
		}

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

		return NextResponse.json({ ok: true, discount: promo.discount });
	} catch (error) {
		console.error('Promo verification error:', error);
		return NextResponse.json({ ok: false, error: 'Something went wrong. Please try again later.' }, { status: 500 });
	}
}
