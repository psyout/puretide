import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { primeProductCache, refreshSheetCaches } from '@/lib/sheetCache';
import { forceRefreshZohoProducts } from '@/lib/zohoInventory';
import { requireDashboardAuth } from '@/lib/dashboardAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RefreshScope = 'all' | 'sheets' | 'zoho';

function hasValidApiKey(request: Request): boolean {
	const provided = request.headers.get('x-api-key');
	const configured = process.env.STOCK_API_KEY;
	if (!provided || !configured) return false;
	const providedBuffer = Buffer.from(provided);
	const configuredBuffer = Buffer.from(configured);
	return providedBuffer.length === configuredBuffer.length && crypto.timingSafeEqual(providedBuffer, configuredBuffer);
}

export async function POST(request: Request) {
	if (!hasValidApiKey(request)) {
		const authError = await requireDashboardAuth(request);
		if (authError) return authError;
	}

	let scope: RefreshScope = 'all';
	try {
		const body = (await request.json()) as { scope?: unknown };
		if (body.scope !== undefined) {
			if (body.scope !== 'all' && body.scope !== 'sheets' && body.scope !== 'zoho') {
				return NextResponse.json({ ok: false, error: 'Scope must be all, sheets, or zoho.' }, { status: 400 });
			}
			scope = body.scope;
		}
	} catch {
		// An empty body keeps backward compatibility with the existing VPS call.
	}

	try {
		const [sheets, products] = await Promise.all([
			scope === 'all' || scope === 'sheets' ? refreshSheetCaches() : Promise.resolve(null),
			scope === 'all' || scope === 'zoho' ? forceRefreshZohoProducts() : Promise.resolve(null),
		]);
		if (products) primeProductCache(products);

		const refreshedAt = new Date().toISOString();
		return NextResponse.json(
			{
				ok: true,
				message: scope === 'all' ? 'Zoho and Google Sheets data refreshed.' : `${scope === 'zoho' ? 'Zoho' : 'Google Sheets'} data refreshed.`,
				scope,
				refreshedAt,
				counts: {
					products: products?.length,
					...sheets,
				},
			},
			{ headers: { 'Cache-Control': 'no-store' } },
		);
	} catch (error) {
		console.error('Production data refresh failed:', error);
		return NextResponse.json(
			{ ok: false, error: error instanceof Error ? error.message : 'Failed to refresh production data.' },
			{ status: 502, headers: { 'Cache-Control': 'no-store' } },
		);
	}
}
