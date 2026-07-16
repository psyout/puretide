import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { buildSafeApiError } from '@/lib/apiError';
import {
	deleteFriendsFamilyAllowlistEntry,
	listFriendsFamilyAllowlistEntries,
	upsertFriendsFamilyAllowlistEntry,
} from '@/lib/ordersDb';
import { normalizeEmail } from '@/lib/friendsFamily';

type UpsertBody = {
	email?: string;
	isActive?: boolean;
	note?: string | null;
};

type DeleteBody = { email?: string };

export async function GET(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const entries = await listFriendsFamilyAllowlistEntries();
		return NextResponse.json({ ok: true, entries }, { status: 200 });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to load Friends & Family allowlist.', error, logLabel: 'dashboard:friends-family:get' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const body = (await request.json()) as UpsertBody;
		const email = normalizeEmail(String(body?.email ?? ''));
		if (!email) return NextResponse.json({ ok: false, error: 'Missing email.' }, { status: 400 });
		const isActive = Boolean(body?.isActive);
		const note = body?.note != null ? String(body.note) : null;
		await upsertFriendsFamilyAllowlistEntry({ email, isActive, note });
		return NextResponse.json({ ok: true }, { status: 200 });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to update Friends & Family allowlist.', error, logLabel: 'dashboard:friends-family:post' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const body = (await request.json()) as DeleteBody;
		const email = normalizeEmail(String(body?.email ?? ''));
		if (!email) return NextResponse.json({ ok: false, error: 'Missing email.' }, { status: 400 });
		await deleteFriendsFamilyAllowlistEntry(email);
		return NextResponse.json({ ok: true }, { status: 200 });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to delete Friends & Family allowlist entry.', error, logLabel: 'dashboard:friends-family:delete' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
