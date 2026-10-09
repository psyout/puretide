import { NextResponse } from 'next/server';
import { readProducts } from '@/lib/productCatalog';

function requireStockReadKey(request: Request): boolean {
	const key = process.env.STOCK_API_KEY;
	if (!key) {
		return process.env.NODE_ENV !== 'production';
	}
	const provided =
		request.headers.get('x-api-key') ??
		request.headers
			.get('authorization')
			?.replace(/^Bearer\s+/i, '')
			.trim();
	return provided === key;
}

export async function GET(request: Request) {
	if (!requireStockReadKey(request)) {
		return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}
	try {
		const items = await readProducts();
		return NextResponse.json({ ok: true, items, source: 'zoho' });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to read stock';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}

function requireStockApiKey(request: Request): boolean {
	const key = process.env.STOCK_API_KEY;
	if (!key) return false;
	const provided =
		request.headers.get('x-api-key') ??
		request.headers
			.get('authorization')
			?.replace(/^Bearer\s+/i, '')
			.trim();
	return provided === key;
}

export async function POST(request: Request) {
	if (!requireStockApiKey(request)) {
		return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}
	return NextResponse.json(
		{ ok: false, error: 'Zoho Inventory is the product source of truth. Edit products directly in Zoho.' },
		{ status: 405, headers: { Allow: 'GET' } },
	);
}
