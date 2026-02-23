import { NextResponse } from 'next/server';
import { createSessionCookie } from '@/lib/dashboardAuth';

export async function POST(request: Request) {
	try {
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
		const message = e instanceof Error ? e.message : 'Failed to create session';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
