import { NextRequest, NextResponse } from 'next/server';
import { processRetryJobs } from '@/lib/retryJobs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Simple cron-like endpoint to process retry jobs
// Call this endpoint periodically (e.g., every 5 minutes) via a scheduler or cron job
export async function GET(request: NextRequest) {
	// Optional: Simple secret-based authentication
	const authHeader = request.headers.get('authorization');
	const expectedSecret = process.env.RETRY_JOB_SECRET;
	
	if (expectedSecret) {
		if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== expectedSecret) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
	} else {
		// In development, allow local requests without auth
		const isDev = process.env.NODE_ENV !== 'production';
		const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
		if (!isDev || (ip !== '127.0.0.1' && ip !== '::1' && !ip.startsWith('192.168.') && !ip.startsWith('10.'))) {
			return NextResponse.json({ error: 'Unauthorized: missing secret' }, { status: 401 });
		}
	}

	try {
		await processRetryJobs();
		return NextResponse.json({ ok: true, message: 'Retry jobs processed' });
	} catch (error) {
		console.error('[retry-jobs-cron] Failed to process retry jobs:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
