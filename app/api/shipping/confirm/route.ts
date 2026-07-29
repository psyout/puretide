import { NextRequest, NextResponse } from 'next/server';
import { triggerShippingConfirmationManually } from '@/lib/wrikeShipping';
import { requireDashboardAuth } from '@/lib/dashboardAuth';

export async function POST(request: NextRequest) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;

	try {
		const body = await request.json();
		const { orderNumber, trackingNumber } = body;

		// Validate required fields
		if (!orderNumber || !trackingNumber) {
			return NextResponse.json(
				{ error: 'Missing required fields: orderNumber and trackingNumber' },
				{ status: 400 }
			);
		}

		console.log(`[shippingConfirm] Manual trigger for order #${orderNumber} with tracking ${trackingNumber}`);

		// Trigger shipping confirmation
		const result = await triggerShippingConfirmationManually(orderNumber, trackingNumber);

		if (result.success) {
			return NextResponse.json({
				success: true,
				message: result.message,
			});
		} else {
			return NextResponse.json(
				{ error: result.error },
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error('[shippingConfirm] Error:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}

export async function GET(request: NextRequest) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;

	return NextResponse.json({
		endpoint: 'Manual shipping confirmation trigger',
		usage: 'POST with { orderNumber: string, trackingNumber: string }',
	});
}
