import '@/lib/api-prelude';

import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { buildSafeApiError } from '@/lib/apiError';
import { dryRunShippingConfirmation, sendTrackingEmailManually } from '@/lib/wrikeShipping';

export async function POST(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;

	try {
		const body = (await request.json()) as {
			orderNumber?: string;
			taskId?: string;
			customerEmail?: string;
			customerName?: string;
			trackingNumber?: string;
			shippingMethod?: 'express';
		};
		const orderNumber = body?.orderNumber ? String(body.orderNumber).trim() : '';
		const taskId = body?.taskId ? String(body.taskId).trim() : '';
		const customerEmail = body?.customerEmail ? String(body.customerEmail).trim() : '';
		const customerName = body?.customerName ? String(body.customerName).trim() : '';
		const trackingNumber = body?.trackingNumber ? String(body.trackingNumber).trim() : '';
		const shippingMethod = body?.shippingMethod;

		if (!orderNumber && !taskId) {
			return NextResponse.json({ ok: false, error: 'Missing required field: orderNumber or taskId' }, { status: 400 });
		}

		const result = await sendTrackingEmailManually({
			orderNumber: orderNumber || undefined,
			taskId: taskId || undefined,
			route: 'dashboard:tracking-email',
			customerEmail: customerEmail || undefined,
			customerName: customerName || undefined,
			trackingNumber: trackingNumber || undefined,
			shippingMethod,
		});
		return NextResponse.json(result, { status: result.ok ? 200 : 500 });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to send tracking email.', error, logLabel: 'dashboard:tracking-email:post' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}

export async function GET(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;

	try {
		const { searchParams } = new URL(request.url);
		const orderNumber = searchParams.get('orderNumber') ? String(searchParams.get('orderNumber')).trim() : '';
		const taskId = searchParams.get('taskId') ? String(searchParams.get('taskId')).trim() : '';
		const trackingNumber = searchParams.get('trackingNumber') ? String(searchParams.get('trackingNumber')) : '';

		const report = await dryRunShippingConfirmation({
			orderNumber: orderNumber || undefined,
			taskId: taskId || undefined,
			trackingNumber: trackingNumber || undefined,
		});
		return NextResponse.json(report, { status: report.ok ? 200 : 400 });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to dry-run shipping confirmation.', error, logLabel: 'dashboard:tracking-email:get' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
