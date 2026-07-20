import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { buildSafeApiError } from '@/lib/apiError';
import { getCachedSheetFriendsFamilyAllowlist } from '@/lib/sheetCache';

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
	return NextResponse.json(
		{ ok: false, error: 'Friends & Family is managed in the Google Sheet. Edit the "Friends & Family" worksheet to add, remove, or change status.' },
		{ status: 405 },
	);
}

export async function DELETE(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	return NextResponse.json(
		{ ok: false, error: 'Friends & Family is managed in the Google Sheet. Edit the "Friends & Family" worksheet to add, remove, or change status.' },
		{ status: 405 },
	);
}
