import { NextResponse } from 'next/server';
import { syncZohoStockSheet } from '@/lib/zohoStockSheetSync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return process.env.NODE_ENV !== 'production';
	const provided = request.headers.get('x-cron-secret') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
	return provided === secret;
}

async function run(request: Request) {
	if (!authorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	try {
		const result = await syncZohoStockSheet();
		return NextResponse.json({ ok: true, syncedAt: new Date().toISOString(), ...result }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		console.error('[zoho-stock-sheet:cron] failed', error);
		return NextResponse.json({ ok: false, error: 'Failed to sync Zoho stock to Google Sheets.' }, { status: 502 });
	}
}

export async function GET(request: Request) {
	return run(request);
}

export async function POST(request: Request) {
	return run(request);
}
