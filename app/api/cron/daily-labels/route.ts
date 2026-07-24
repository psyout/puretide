import '@/lib/api-prelude';

import { NextResponse } from 'next/server';
import { buildSafeApiError } from '@/lib/apiError';
import { isExplicitDevBypassEnabled } from '@/lib/authEnv';
import { getWrikeConfig } from '@/lib/env';
import { generateAndAttachDailyLabels } from '@/lib/wrikeDailyLabels';
import { createLabelGenerationRun, updateLabelGenerationRun, getLabelGenerationRun, type LabelGenerationRun } from '@/lib/ordersDb';

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

	let run: LabelGenerationRun | null = null;

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

		const isoDate = base.toISOString().slice(0, 10);

		console.log('[cron:daily-labels] start', {
			requestedDate: requested ? requested.toISOString().slice(0, 10) : null,
			resolvedDate: isoDate,
		});

		// Check for existing run (distributed lock via database)
		const existingRun = await getLabelGenerationRun('daily', isoDate);
		if (existingRun && existingRun.status === 'running') {
			console.warn('[cron:daily-labels] skipping: already running', { runId: existingRun.id, startedAt: existingRun.startedAt });
			return NextResponse.json({ ok: false, error: 'Label generation already in progress for this date', runId: existingRun.id }, { status: 409 });
		}

		// Create new run record
		run = await createLabelGenerationRun({
			cronType: 'daily',
			date: isoDate,
			ordersConsidered: 0,
			labelsParsed: 0,
			status: 'running',
		});

		console.log('[cron:daily-labels] run created', { runId: run.id, date: isoDate });

		const result = await generateAndAttachDailyLabels({
			apiToken: wrike.apiToken,
			ordersFolderId: wrike.ordersFolderId,
			labelsFolderId,
			date: base,
		});

		// Update run with results
		const completedAt = new Date().toISOString();
		await updateLabelGenerationRun(run.id, {
			status: result.ok ? 'completed' : 'failed',
			ordersConsidered: result.ok ? result.ordersConsidered : (result.ordersConsidered ?? 0),
			labelsParsed: result.ok ? result.labelsParsed : (result.labelsParsed ?? 0),
			reason: result.ok ? undefined : result.reason,
			wrikeTaskId: result.ok ? result.dailyTaskId : undefined,
			wrikeAttachmentId: result.ok ? result.attachmentId : undefined,
			completedAt,
			errorMessage: result.ok ? undefined : result.reason,
		});

		console.log('[cron:daily-labels] done', { ...result, runId: run.id, completedAt });

		return NextResponse.json({ ...result, runId: run.id }, { status: 200 });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to generate daily labels.', error, logLabel: 'cron:daily-labels:post' });
		console.error('[cron:daily-labels] failed', { errorId: safe.errorId, message: safe.message, runId: run?.id });

		// Mark run as failed if we have one
		if (run) {
			try {
				await updateLabelGenerationRun(run.id, {
					status: 'failed',
					completedAt: new Date().toISOString(),
					errorMessage: safe.message,
				});
			} catch (updateError) {
				console.error('[cron:daily-labels] failed to update run status', { runId: run.id, error: updateError });
			}
		}

		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId, runId: run?.id }, { status: 500 });
	}
}
