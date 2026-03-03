import { NextResponse } from 'next/server';
import { createSessionCookie } from '@/lib/dashboardAuth';
import { checkRateLimit } from '@/lib/rateLimit';
import { buildSafeApiError } from '@/lib/apiError';

export async function POST(request: Request) {
	try {
		const { allowed } = checkRateLimit(request, 'dashboard-login', 10, 60 * 60 * 1000);
		if (!allowed) {
			return NextResponse.json({ ok: false, error: 'Too many login attempts. Please try again later.' }, { status: 429 });
		}
		const secretEnv = process.env.DASHBOARD_SECRET;
		if (!secretEnv || secretEnv.trim() === '') {
			return NextResponse.json(
				{ ok: false, error: 'Dashboard is not configured. Set DASHBOARD_SECRET in the environment to enable.' },
				{ status: 503 }
			);
		}
		const body = (await request.json()) as { secret?: string };
		const secret = body?.secret?.trim();
		if (!secret) {
			return NextResponse.json({ ok: false, error: 'Missing secret.' }, { status: 400 });
		}
		if (secret !== secretEnv) {
			return NextResponse.json({ ok: false, error: 'Invalid secret.' }, { status: 401 });
		}
		const { name, value, options } = createSessionCookie();
		const res = NextResponse.json({ ok: true }, { status: 200 });
		res.headers.set('Set-Cookie', `${name}=${value}; ${options}`);
		return res;
	} catch (e) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to create session.', error: e, logLabel: 'dashboard-session:post' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
