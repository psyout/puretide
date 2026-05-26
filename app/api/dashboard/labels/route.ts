import '@/lib/api-prelude';

import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { buildSafeApiError } from '@/lib/apiError';
import { getWrikeConfig } from '@/lib/env';
import { generateAndAttachDailyLabels, generateAndAttachLabelsForRange } from '@/lib/wrikeDailyLabels';

function parseIsoDateOnly(s: string | null): Date | null {
	if (!s) return null;
	const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return null;
	const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
	if (Number.isNaN(d.getTime())) return null;
	return d;
}

export async function POST(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;

	try {
		const body = (await request.json()) as { date?: string; startDate?: string; endDate?: string };
		const requested = parseIsoDateOnly(body?.date ?? null);
		const requestedStart = parseIsoDateOnly(body?.startDate ?? null);
		const requestedEnd = parseIsoDateOnly(body?.endDate ?? null);
		const base = requested ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

		const wrike = getWrikeConfig();
		if (!wrike?.apiToken || !wrike.ordersFolderId) {
			return NextResponse.json({ ok: false, error: 'Wrike not configured.' }, { status: 503 });
		}
		const labelsFolderId = wrike.labelsFolderId;
		if (!labelsFolderId) {
			return NextResponse.json({ ok: false, error: 'Missing WRIKE_LABELS_FOLDER_ID.' }, { status: 503 });
		}
		const result =
			requestedStart && requestedEnd
				? await generateAndAttachLabelsForRange({
						apiToken: wrike.apiToken,
						ordersFolderId: wrike.ordersFolderId,
						labelsFolderId,
						startDate: requestedStart,
						endDate: requestedEnd,
						title: `Labels ${body.startDate} to ${body.endDate}`,
						description: `Avery 5162/8162 label sheets for ${body.startDate} to ${body.endDate}`,
					})
				: await generateAndAttachDailyLabels({
						apiToken: wrike.apiToken,
						ordersFolderId: wrike.ordersFolderId,
						labelsFolderId,
						date: base,
					});

		return NextResponse.json(result, { status: 200 });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to generate daily labels.', error, logLabel: 'dashboard:labels:post' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
