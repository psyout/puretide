import { NextResponse } from 'next/server';
import { processAbandonedCarts } from '@/lib/abandonedCartProcessor';

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
		return NextResponse.json({ ok: true, ...(await processAbandonedCarts()) });
	} catch (error) {
		console.error('[abandoned-cart:cron] failed', error);
		return NextResponse.json({ ok: false, error: 'Failed to process abandoned carts.' }, { status: 500 });
	}
}

export async function GET(request: Request) {
	return run(request);
}

export async function POST(request: Request) {
	return run(request);
}
