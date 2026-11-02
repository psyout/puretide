import { NextRequest, NextResponse } from 'next/server';
import { reconcileOrderAttribution } from '@/lib/orderAttribution';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
	const expected = process.env.CRON_SECRET;
	if (!expected || request.headers.get('x-cron-secret') !== expected) {
		return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}
	try {
		const result = await reconcileOrderAttribution(50);
		return NextResponse.json(result);
	} catch (error) {
		console.error('[order-attribution] Worker failed', error);
		return NextResponse.json({ ok: false, error: 'Attribution worker failed.' }, { status: 500 });
	}
}
