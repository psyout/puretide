import '@/lib/api-prelude';

import { NextResponse } from 'next/server';
import { buildSafeApiError } from '@/lib/apiError';
import { isExplicitDevBypassEnabled } from '@/lib/authEnv';
import { getWrikeConfig } from '@/lib/env';
import { generateAndAttachDailyLabels } from '@/lib/wrikeDailyLabels';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function requireCronSecret(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return isExplicitDevBypassEnabled('ALLOW_UNAUTH_CRON_DAILY_LABELS');
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
	const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
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
		const requested = parseIsoDateOnly(dateParam);

		// Default: yesterday (local server time, DST-safe)
		let base: Date;
		if (requested) {
			base = requested;
		} else {
			const todayStart = new Date();
			todayStart.setHours(0, 0, 0, 0);
			const y = new Date(todayStart);
			y.setDate(y.getDate() - 1);
			base = y;
		}

		console.log('[cron:daily-labels] start', {
			requestedDate: requested ? requested.toISOString().slice(0, 10) : null,
			resolvedDate: base.toISOString().slice(0, 10),
		});

		const result = await generateAndAttachDailyLabels({
			apiToken: wrike.apiToken,
			ordersFolderId: wrike.ordersFolderId,
			labelsFolderId,
			date: base,
		});

		console.log('[cron:daily-labels] done', result);

		return NextResponse.json(result, { status: 200 });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to generate daily labels.', error, logLabel: 'cron:daily-labels:post' });
		console.error('[cron:daily-labels] failed', { errorId: safe.errorId, message: safe.message });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
