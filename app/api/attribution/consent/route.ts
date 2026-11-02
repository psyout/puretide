import { NextRequest, NextResponse } from 'next/server';
import {
	analyticsConsentCookie,
	attributionUiEnabled,
	captureAttributionVisit,
	clearAttributionCookie,
} from '@/lib/orderAttribution';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
	if (!attributionUiEnabled()) {
		return NextResponse.json({ ok: false, error: 'Attribution QA is disabled.' }, { status: 404 });
	}
	let body: { allowed?: unknown; landingPath?: unknown };
	try {
		body = (await request.json()) as { allowed?: unknown; landingPath?: unknown };
	} catch {
		return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
	}
	if (typeof body.allowed !== 'boolean') {
		return NextResponse.json({ ok: false, error: 'Invalid consent choice.' }, { status: 400 });
	}
	const landingPath = typeof body.landingPath === 'string' && body.landingPath.startsWith('/') && !body.landingPath.startsWith('//') ? body.landingPath : '/';
	const response = NextResponse.json({ ok: true, allowed: body.allowed });
	response.headers.append('Set-Cookie', analyticsConsentCookie(body.allowed));

	if (!body.allowed) {
		response.headers.append('Set-Cookie', clearAttributionCookie);
		return response;
	}

	const storeOrigin = process.env.ATTRIBUTION_STORE_ORIGIN ?? 'https://puretide.ca';
	const captured = await captureAttributionVisit(`${storeOrigin}${landingPath}`, request.headers.get('cookie'), true);
	if (captured.setCookie) response.headers.append('Set-Cookie', captured.setCookie);
	return NextResponse.json(
		{ ok: captured.ok, allowed: true, status: captured.status },
		{ headers: response.headers, status: captured.ok ? 200 : 503 },
	);
}
