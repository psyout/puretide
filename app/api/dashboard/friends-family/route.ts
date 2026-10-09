import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { buildSafeApiError } from '@/lib/apiError';
import { addSheetFriendsFamilyEmail, deleteSheetFriendsFamilyEmail, renameSheetFriendsFamilyEmail, setSheetFriendsFamilyEmailStatus } from '@/lib/stockSheet';
import { getCachedSheetFriendsFamilyAllowlist, invalidateFriendsFamilyCache } from '@/lib/sheetCache';

export async function GET(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const entries = await getCachedSheetFriendsFamilyAllowlist();
		return NextResponse.json({ ok: true, entries, source: 'google_sheets' }, { status: 200 });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to load Friends & Family allowlist.', error, logLabel: 'dashboard:friends-family:get' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const body = (await request.json()) as { email?: unknown };
		const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return NextResponse.json({ ok: false, error: 'Enter a valid email address.' }, { status: 400 });
		}
		const result = await addSheetFriendsFamilyEmail(email);
		invalidateFriendsFamilyCache();
		const entries = await getCachedSheetFriendsFamilyAllowlist();
		return NextResponse.json({ ok: true, result, entries }, { status: result === 'added' ? 201 : 200 });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to add Friends & Family email.', error, logLabel: 'dashboard:friends-family:post' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}

export async function PATCH(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const body = (await request.json()) as { email?: unknown; newEmail?: unknown; isActive?: unknown };
		const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
		const newEmail = typeof body.newEmail === 'string' ? body.newEmail.trim().toLowerCase() : '';
		const hasStatus = typeof body.isActive === 'boolean';
		const hasNewEmail = Boolean(newEmail);
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (!hasStatus && !hasNewEmail) || (hasNewEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail))) {
			return NextResponse.json({ ok: false, error: 'A valid email and update are required.' }, { status: 400 });
		}
		if (hasNewEmail && newEmail !== email) await renameSheetFriendsFamilyEmail(email, newEmail);
		if (hasStatus) await setSheetFriendsFamilyEmailStatus(hasNewEmail ? newEmail : email, body.isActive as boolean);
		invalidateFriendsFamilyCache();
		const entries = await getCachedSheetFriendsFamilyAllowlist();
		return NextResponse.json({ ok: true, entries }, { status: 200 });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to update Friends & Family status.', error, logLabel: 'dashboard:friends-family:patch' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const body = (await request.json()) as { email?: unknown };
		const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return NextResponse.json({ ok: false, error: 'A valid email is required.' }, { status: 400 });
		}
		await deleteSheetFriendsFamilyEmail(email);
		invalidateFriendsFamilyCache();
		const entries = await getCachedSheetFriendsFamilyAllowlist();
		return NextResponse.json({ ok: true, entries }, { status: 200 });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to delete Friends & Family email.', error, logLabel: 'dashboard:friends-family:delete' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
