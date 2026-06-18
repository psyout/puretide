import '@/lib/api-prelude';

import { NextResponse } from 'next/server';
import { buildSafeApiError } from '@/lib/apiError';
import { isExplicitDevBypassEnabled } from '@/lib/authEnv';
import { getWrikeConfig } from '@/lib/env';
import { generateAndAttachLabelsForRange } from '@/lib/wrikeDailyLabels';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function requireCronSecret(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return isExplicitDevBypassEnabled('ALLOW_UNAUTH_CRON_LABELS_RANGE');
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
		const startParam = url.searchParams.get('startDate');
		const endParam = url.searchParams.get('endDate');
		const titleParam = url.searchParams.get('title');

		const startDate = parseIsoDateOnly(startParam);
		const endDate = parseIsoDateOnly(endParam);
		if (!startDate || !endDate) {
			return NextResponse.json({ ok: false, error: 'Missing or invalid startDate/endDate. Expected YYYY-MM-DD.' }, { status: 400 });
		}

		const startIso = String(startParam);
		const endIso = String(endParam);
		const title = (titleParam ?? '').trim() || `Labels ${startIso} to ${endIso}`;

		console.log('[cron:labels-range] start', { startDate: startIso, endDate: endIso, title });

		const result = await generateAndAttachLabelsForRange({
			apiToken: wrike.apiToken,
			ordersFolderId: wrike.ordersFolderId,
			labelsFolderId,
			startDate,
			endDate,
			title,
			description: `Avery 5160/8160 label sheets for ${startIso} to ${endIso}`,
		});

		console.log('[cron:labels-range] done', result);
		return NextResponse.json(result, { status: 200 });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to generate range labels.', error, logLabel: 'cron:labels-range:post' });
		console.error('[cron:labels-range] failed', { errorId: safe.errorId, message: safe.message });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
