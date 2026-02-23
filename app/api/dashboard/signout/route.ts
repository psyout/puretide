import { NextResponse } from 'next/server';
import { DASHBOARD_COOKIE_NAME } from '@/lib/dashboardAuth';

export async function POST(request: Request) {
	const res = NextResponse.json({ ok: true }, { status: 200 });
	res.headers.set(
		'Set-Cookie',
		`${DASHBOARD_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
	);
	return res;
}
