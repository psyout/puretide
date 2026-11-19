import '@/lib/api-prelude';

import { NextResponse } from 'next/server';
import { buildSafeApiError } from '@/lib/apiError';
import { isExplicitDevBypassEnabled } from '@/lib/authEnv';
import { getWrikeConfig } from '@/lib/env';
import { generateAndAttachDailyLabels, getPreviousVancouverDate } from '@/lib/wrikeDailyLabels';
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
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
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

		// The morning batch is named for the date on which its 6 AM Vancouver
		// window starts. At 6 AM today, process yesterday 6 AM through today 6 AM.
		const isoDate = dateParam ? dateParam : getPreviousVancouverDate(new Date());
		const base = requested ?? parseIsoDateOnly(isoDate);
		if (!base || (dateParam && !requested)) {
			return NextResponse.json({ ok: false, error: 'Invalid date. Expected YYYY-MM-DD.' }, { status: 400 });
		}

		// Keep the lock/run key on the Vancouver business date used by the generator.
		console.log('[cron:daily-labels] start', {
			requestedDate: requested ? requested.toISOString().slice(0, 10) : null,
			resolvedDate: isoDate,
		});

		// Check for existing run (distributed lock via database)
		const existingRun = await getLabelGenerationRun('daily', isoDate);
		if (existingRun?.status === 'completed' && existingRun.wrikeTaskId && existingRun.wrikeAttachmentId) {
			return NextResponse.json({ ok: true, date: isoDate, alreadyCompleted: true, runId: existingRun.id });
		}
		if (existingRun && existingRun.status === 'running') {
			const ageMs = Date.now() - new Date(existingRun.startedAt).getTime();
			if (Number.isFinite(ageMs) && ageMs < 15 * 60 * 1000) {
				console.warn('[cron:daily-labels] skipping: already running', { runId: existingRun.id, startedAt: existingRun.startedAt });
				return NextResponse.json({ ok: false, error: 'Label generation already in progress for this date', runId: existingRun.id }, { status: 409 });
			}
			await updateLabelGenerationRun(existingRun.id, {
				status: 'failed',
				completedAt: new Date().toISOString(),
				errorMessage: 'Stale label-generation lock expired after 15 minutes.',
			});
			console.warn('[cron:daily-labels] expired stale run', { runId: existingRun.id, startedAt: existingRun.startedAt });
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

		// Every unsuccessful result must fail HTTP so the scheduler can retry it.
		const status = result.ok ? 200 : 422;
		return NextResponse.json({ ...result, runId: run.id }, { status });
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
