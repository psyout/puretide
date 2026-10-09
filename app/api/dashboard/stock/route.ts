import { NextResponse } from 'next/server';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { readProducts } from '@/lib/productCatalog';
import { invalidateProductCache } from '@/lib/sheetCache';
import { updateZohoWebsiteStatus, type ZohoWebsiteStatus } from '@/lib/zohoInventory';

async function readAvailableCoaFiles(): Promise<string[]> {
	try {
		return (await readdir(path.join(process.cwd(), 'public', 'coa'))).filter((file) => file.toLowerCase().endsWith('.pdf'));
	} catch (error) {
		console.warn('[dashboard/stock] Could not read COA directory.', error);
		return [];
	}
}

export async function GET(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const [items, coaFiles] = await Promise.all([readProducts(), readAvailableCoaFiles()]);
		return NextResponse.json({ ok: true, items, coaFiles, source: 'zoho' });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to read stock';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	return NextResponse.json(
		{ ok: false, error: 'Zoho Inventory is the product source of truth. Edit products directly in Zoho.' },
		{ status: 405, headers: { Allow: 'GET' } },
	);
}

export async function PATCH(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;

	try {
		const body = (await request.json()) as { productId?: unknown; status?: unknown };
		const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
		const status = typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
		if (!productId || !['published', 'draft', 'inactive'].includes(status)) {
			return NextResponse.json({ ok: false, error: 'A product ID and valid Website Status are required.' }, { status: 400 });
		}

		const item = await updateZohoWebsiteStatus(productId, status as ZohoWebsiteStatus);
		invalidateProductCache();
		return NextResponse.json({ ok: true, item });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to update Website Status in Zoho Inventory.';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
