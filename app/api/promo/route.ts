import { NextResponse } from 'next/server';
import { readSheetPromoCodes, writeSheetPromoCodes } from '@/lib/stockSheet';
import type { PromoCode } from '@/types/product';
import { isExplicitDevBypassEnabled } from '@/lib/authEnv';
import { buildSafeApiError } from '@/lib/apiError';

function requirePromoApiKey(request: Request): boolean {
	const key = process.env.PROMO_API_KEY;
	if (!key) {
		return isExplicitDevBypassEnabled('ALLOW_UNAUTH_PROMO_API');
	}
	const provided = request.headers.get('x-api-key') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
	return provided === key;
}

export async function GET(request: Request) {
	if (!requirePromoApiKey(request)) {
		return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}
	try {
		const codes = await readSheetPromoCodes();
		return NextResponse.json({ ok: true, codes });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to read promo codes.', error, logLabel: 'promo:get' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}

export async function POST(request: Request) {
	if (!requirePromoApiKey(request)) {
		return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}
	try {
		const payload = (await request.json()) as { codes: PromoCode[] };
		const codes = payload?.codes ?? [];
		await writeSheetPromoCodes(codes);
		return NextResponse.json({ ok: true });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to update promo codes.', error, logLabel: 'promo:post' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
