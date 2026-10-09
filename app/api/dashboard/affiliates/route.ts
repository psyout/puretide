import { NextResponse } from 'next/server';
import { buildAffiliateReport, DEFAULT_AFFILIATE_REPORT_TIME_ZONE } from '@/lib/affiliateCommissions';
import { buildSafeApiError } from '@/lib/apiError';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { listOrdersFromDb } from '@/lib/ordersDb';
import { readSheetPromoCodes } from '@/lib/stockSheet';
import { listWrikeAffiliateOrders, mergeAffiliateOrderSources } from '@/lib/wrikeAffiliateOrders';

const currentMonth = () => {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: DEFAULT_AFFILIATE_REPORT_TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
	}).formatToParts(new Date());
	return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
};

export async function GET(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;

	try {
		const month = new URL(request.url).searchParams.get('month') ?? currentMonth();
		if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
			return NextResponse.json({ ok: false, error: 'Month must use YYYY-MM format.' }, { status: 400 });
		}
		const [databaseOrders, promoCodes, wrikeOrders] = await Promise.all([
			listOrdersFromDb(),
			readSheetPromoCodes(),
			listWrikeAffiliateOrders().catch((error) => {
				console.warn('[dashboard:affiliates] Wrike history unavailable; using the order database only.', error);
				return [];
			}),
		]);
		const orders = mergeAffiliateOrderSources(databaseOrders, wrikeOrders);
		const report = buildAffiliateReport({ orders, promoCodes, month });
		return NextResponse.json({ ok: true, report });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to build affiliate payout report.', error, logLabel: 'dashboard:affiliates:get' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
