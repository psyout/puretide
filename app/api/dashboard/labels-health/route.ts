import '@/lib/api-prelude';

import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { getRecentLabelGenerationRuns } from '@/lib/ordersDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) {
		return authError;
	}

	try {
		const recentRuns = await getRecentLabelGenerationRuns(20);

		// Calculate health metrics
		const totalRuns = recentRuns.length;
		const completedRuns = recentRuns.filter((r) => r.status === 'completed').length;
		const failedRuns = recentRuns.filter((r) => r.status === 'failed').length;
		const runningRuns = recentRuns.filter((r) => r.status === 'running').length;
		const noLabelsRuns = recentRuns.filter((r) => r.status === 'completed' && r.labelsParsed === 0).length;

		// Check for recent failures
		const lastFailedRun = recentRuns.find((r) => r.status === 'failed');
		const lastCompletedRun = recentRuns.find((r) => r.status === 'completed');

		// Determine overall health
		let health = 'healthy';
		const issues: string[] = [];

		if (failedRuns > 0) {
			health = 'degraded';
			issues.push(`${failedRuns} failed runs in recent history`);
		}

		if (runningRuns > 1) {
			health = 'degraded';
			issues.push(`${runningRuns} runs currently running (possible stuck jobs)`);
		}

		if (noLabelsRuns > 5 && totalRuns > 10) {
			health = 'degraded';
			issues.push(`${noLabelsRuns} recent runs produced zero labels`);
		}

		if (lastFailedRun && (!lastCompletedRun || new Date(lastFailedRun.completedAt!) > new Date(lastCompletedRun.completedAt!))) {
			health = 'unhealthy';
			issues.push('Most recent run failed');
		}

		return NextResponse.json(
			{
				ok: true,
				health,
				issues,
				metrics: {
					totalRuns,
					completedRuns,
					failedRuns,
					runningRuns,
					noLabelsRuns,
				},
				runs: recentRuns,
				lastCompleted: lastCompletedRun?.completedAt ?? null,
				lastFailed: lastFailedRun?.completedAt ?? null,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('[dashboard:labels-health] failed', { error });
		return NextResponse.json({ ok: false, error: 'Failed to fetch label generation health' }, { status: 500 });
	}
}
