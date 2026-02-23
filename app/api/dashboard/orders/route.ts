import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { listOrdersFromDb } from '@/lib/ordersDb';

export async function GET(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const orders = await listOrdersFromDb();
		const sorted = [...orders].sort((a, b) => {
			const aT = String(a.createdAt ?? '');
			const bT = String(b.createdAt ?? '');
			return bT.localeCompare(aT);
		});
		return NextResponse.json({ ok: true, orders: sorted });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to read orders';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
