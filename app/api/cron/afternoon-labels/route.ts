import '@/lib/api-prelude';

import { NextResponse } from 'next/server';
import { buildSafeApiError } from '@/lib/apiError';
import { isExplicitDevBypassEnabled } from '@/lib/authEnv';
import { getWrikeConfig } from '@/lib/env';
import { generateAndAttachAfternoonLabels } from '@/lib/wrikeDailyLabels';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function requireCronSecret(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return isExplicitDevBypassEnabled('ALLOW_UNAUTH_CRON_AFTERNOON_LABELS');
	}
	const provided =
		request.headers.get('x-cron-secret') ??
		request.headers
			.get('authorization')
			?.replace(/^Bearer\s+/i, '')
			.trim();
	return provided === secret;
}

function parseIsoDateOnly(s: string | null): Date | null {
	if (!s) return null;
	const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return null;
	// Parse date parts directly to avoid timezone conversion issues
	const year = parseInt(m[1], 10);
	const month = parseInt(m[2], 10) - 1; // JavaScript months are 0-indexed
	const day = parseInt(m[3], 10);
	const d = new Date(year, month, day, 0, 0, 0);
	if (Number.isNaN(d.getTime())) return null;
	return d;
}

export async function POST(request: Request) {
	if (!requireCronSecret(request)) {
		return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}

	try {
		const wrike = getWrikeConfig();
		if (!wrike?.apiToken || !wrike.ordersFolderId) {
			return NextResponse.json({ ok: false, error: 'Wrike not configured.' }, { status: 503 });
		}
		const labelsFolderId = wrike.labelsFolderId;
		if (!labelsFolderId) {
			return NextResponse.json({ ok: false, error: 'Missing WRIKE_LABELS_FOLDER_ID.' }, { status: 503 });
		}

		const url = new URL(request.url);
		const dateParam = url.searchParams.get('date');
		const testMode = url.searchParams.get('test') === 'true';
		const forceUpload = url.searchParams.get('force') === 'true';
		const requested = parseIsoDateOnly(dateParam);

		console.log('[cron:afternoon-labels] start', {
			cronType: 'afternoon',
			testMode,
			forceUpload,
			requestedDate: requested ? requested.toISOString().slice(0, 10) : null,
		});

		const result = await generateAndAttachAfternoonLabels({
			apiToken: wrike.apiToken,
			ordersFolderId: wrike.ordersFolderId,
			labelsFolderId,
			date: requested || undefined,
			forceUpload,
		});

		console.log('[cron:afternoon-labels] done', result);

		return NextResponse.json(result, { status: 200 });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to generate afternoon labels.', error, logLabel: 'cron:afternoon-labels:post' });
		console.error('[cron:afternoon-labels] failed', { errorId: safe.errorId, message: safe.message });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
