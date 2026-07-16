import { NextResponse } from 'next/server';
import { getVerifiedFriendsFamilyEmailFromCookie, isFriendsFamilyEnabled } from '@/lib/friendsFamily';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
	if (!isFriendsFamilyEnabled()) {
		return NextResponse.json({ ok: true, enabled: false, verified: false }, { status: 200 });
	}
	const cookieHeader = request.headers.get('cookie');
	const email = getVerifiedFriendsFamilyEmailFromCookie(cookieHeader);
	return NextResponse.json({ ok: true, enabled: true, verified: Boolean(email) }, { status: 200 });
}
