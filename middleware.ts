import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'dashboard_session';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function verifyDashboardCookie(value: string | undefined): Promise<boolean> {
	const secret = process.env.DASHBOARD_SECRET;
	if (!secret || !value) return false;
	const [timestamp, signature] = value.split('.');
	if (!timestamp || !signature) return false;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`dashboard-${timestamp}`));
	const expectedHex = Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	return signature.toLowerCase() === expectedHex.toLowerCase();
}

function isExpired(timestamp: string): boolean {
	const t = Number(timestamp);
	return Number.isNaN(t) || t < Date.now() - COOKIE_MAX_AGE_MS;
}

export async function middleware(request: NextRequest) {
	const pathname = request.nextUrl.pathname;
	if (!pathname.startsWith('/dashboard')) {
		return NextResponse.next();
	}
	if (pathname === '/dashboard/login') {
		return NextResponse.next();
	}
	// Always require auth for dashboard: no secret means redirect to login (session API will return "not configured")
	const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
	const timestamp = cookieValue?.split('.')[0] ?? '';
	if (!cookieValue || isExpired(timestamp) || !(await verifyDashboardCookie(cookieValue))) {
		return NextResponse.redirect(new URL('/dashboard/login', request.url));
	}
	return NextResponse.next();
}

export const config = {
	matcher: ['/dashboard/:path*'],
};
