import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { writeSheetProducts } from '@/lib/stockSheet';
import { validateStockItems } from '@/lib/stockValidation';
import { sendLowStockAlert } from '@/lib/email';

const LOW_STOCK_THRESHOLD = 5;

export async function POST(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const payload = (await request.json()) as { items?: unknown };
		const itemsPayload = payload?.items ?? [];
		const validation = validateStockItems(itemsPayload);
		if (!validation.valid) {
			return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
		}
		const items = validation.items;
		await writeSheetProducts(items);
		const lowStock = items.filter((item) => Number(item.stock) <= LOW_STOCK_THRESHOLD);
		await sendLowStockAlert(lowStock);
		return NextResponse.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to update stock';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
