import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { readSheetPromoCodes, writeSheetPromoCodes } from '@/lib/stockSheet';
import type { PromoCode } from '@/types/product';

export async function GET(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const codes = await readSheetPromoCodes();
		return NextResponse.json({ ok: true, codes });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to read promo codes';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const payload = (await request.json()) as { codes?: PromoCode[] };
		const codes = payload?.codes ?? [];
		await writeSheetPromoCodes(codes);
		return NextResponse.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to update promo codes';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
