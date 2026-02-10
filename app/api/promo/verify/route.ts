import { NextResponse } from 'next/server';
import { readSheetPromoCodes } from '@/lib/stockSheet';

export async function POST(request: Request) {
	try {
		const { code } = (await request.json()) as { code: string };
		if (!code) {
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
		const message = error instanceof Error ? error.message : 'Internal server error';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
