import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { getRecentRetryJobs } from '@/lib/ordersDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;

	try {
		const now = new Date().toISOString();
		const jobs = await getRecentRetryJobs();
		const dueJobs = jobs.filter((job) => job.status === 'pending' && job.nextRunAt <= now);
		const failedJobs = jobs.filter((job) => job.status === 'failed');

		return NextResponse.json({
			ok: true,
			generatedAt: now,
			dueRetryJobs: dueJobs.length,
			failedRetryJobs: failedJobs.length,
			jobs: jobs.map((job) => ({
				id: job.id,
				orderSession: job.session,
				status: job.status,
				attempts: job.attempts,
				nextRunAt: job.nextRunAt,
				lastError: job.lastError ?? null,
			})),
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('[dashboard:operations-health] failed', { error });
		return NextResponse.json({ ok: false, error: 'Failed to fetch operations health.' }, { status: 500 });
	}
}
