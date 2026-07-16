import { NextResponse } from 'next/server';
import { buildSafeApiError } from '@/lib/apiError';
import { isFriendsFamilyEnabled, normalizeEmail, verifyFriendsFamilyOtp } from '@/lib/friendsFamily';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = { email?: string; code?: string };

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as Body;
		const email = normalizeEmail(String(body?.email ?? ''));
		const code = String(body?.code ?? '').trim();
		if (!isFriendsFamilyEnabled()) {
			return NextResponse.json({ ok: false, error: 'Friends & Family is currently unavailable.' }, { status: 403 });
		}

		const result = await verifyFriendsFamilyOtp(request, { email, code });
		if (!result.ok || !result.cookie) {
			return NextResponse.json({ ok: false, error: result.error ?? 'Invalid verification code.' }, { status: 400 });
		}

		const res = NextResponse.json({ ok: true }, { status: 200 });
		res.headers.set('Set-Cookie', `${result.cookie.name}=${result.cookie.value}; ${result.cookie.options}`);
		return res;
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to verify code.', error, logLabel: 'friends-family:verify' });
		console.error(JSON.stringify({ label: 'friends-family:verify:error', errorId: safe.errorId }));
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
