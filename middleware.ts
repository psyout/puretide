import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'dashboard_session';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Bot detection patterns
const BOT_PATTERNS = [
	/googlebot/i,
	/bingbot/i,
	/slurp/i, // Yahoo
	/duckduckbot/i,
	/baiduspider/i,
	/yandexbot/i,
	/facebookexternalhit/i,
	/twitterbot/i,
	/whatsapp/i,
	/telegrambot/i,
	/linkedinbot/i,
	/pinterestbot/i,
	/applebot/i,
	/mj12bot/i,
	/ahrefsbot/i,
	/semrushbot/i,
	/mozbot/i,
];

async function verifyDashboardCookie(value: string | undefined): Promise<boolean> {
	const secret = process.env.DASHBOARD_SECRET;
	if (!secret || !value) return false;
	const [timestamp, signature] = value.split('.');
	if (!timestamp || !signature) return false;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
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

function isBot(userAgent: string | null): boolean {
	if (!userAgent) return false;
	return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export async function middleware(request: NextRequest) {
	const pathname = request.nextUrl.pathname;
	const userAgent = request.headers.get('user-agent');

	// Block bots from accessing the site
	if (isBot(userAgent)) {
		return new Response('Access denied', {
			status: 403,
			headers: {
				'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
			},
		});
	}

	// Skip dashboard auth for API routes, static files, and favicon
	if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('favicon.ico')) {
		return NextResponse.next();
	}

	// Apply dashboard auth if accessing dashboard routes
	if (pathname.startsWith('/dashboard')) {
		if (pathname === '/dashboard/login') {
			return NextResponse.next();
		}
		const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
		const timestamp = cookieValue?.split('.')[0] ?? '';
		if (!cookieValue || isExpired(timestamp) || !(await verifyDashboardCookie(cookieValue))) {
			return NextResponse.redirect(new URL('/dashboard/login', request.url));
		}
	}

	// Allow all other users (guests) to access the site
	return NextResponse.next();
}

export const config = {
	matcher: ['/((?!api|_next/static|favicon.ico).*)'],
};
