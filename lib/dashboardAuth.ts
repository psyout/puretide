import crypto from 'crypto';
import { NextResponse } from 'next/server';

export const DASHBOARD_COOKIE_NAME = 'dashboard_session';
const COOKIE_NAME = DASHBOARD_COOKIE_NAME;
const COOKIE_MAX_AGE_DAYS = 7;

function getSecret(): string | undefined {
	return process.env.DASHBOARD_SECRET;
}

function signValue(value: string, secret: string): string {
	return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function createSessionCookie(): { name: string; value: string; options: string } {
	const secret = getSecret();
	if (!secret) {
		throw new Error('DASHBOARD_SECRET is not set');
	}
	const timestamp = String(Date.now());
	const signature = signValue(`dashboard-${timestamp}`, secret);
	const value = `${timestamp}.${signature}`;
	const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
	const options = `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
	return { name: COOKIE_NAME, value, options };
}

export function verifySessionCookie(cookieHeader: string | null): boolean {
	const secret = getSecret();
	if (!secret) return false;
	if (!cookieHeader) return false;
	const cookies = cookieHeader.split(';').map((c) => c.trim());
	const sessionCookie = cookies.find((c) => c.startsWith(`${COOKIE_NAME}=`));
	if (!sessionCookie) return false;
	const value = sessionCookie.slice(COOKIE_NAME.length + 1).trim();
	const [timestamp, signature] = value.split('.');
	if (!timestamp || !signature) return false;
	const expected = signValue(`dashboard-${timestamp}`, secret);
	if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
		return false;
	}
	const ts = Number(timestamp);
	if (Number.isNaN(ts) || ts < Date.now() - COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
		return false;
	}
	return true;
}

export function requireDashboardAuth(request: Request): NextResponse | null {
	const cookieHeader = request.headers.get('cookie');
	if (!verifySessionCookie(cookieHeader)) {
		return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}
	return null;
}
