import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { readSheetProducts, writeSheetProducts } from '@/lib/stockSheet';
import { validateStockItems } from '@/lib/stockValidation';
import { sendLowStockAlert } from '@/lib/email';
import { getAllProductInventory, syncNewProductsFromSheets } from '@/lib/wrikeProducts';

const LOW_STOCK_THRESHOLD = 5;

export async function GET(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const catalogProducts = await readSheetProducts();
		const wrikeInventory = await getAllProductInventory();

		if (wrikeInventory.length > 0) {
			await syncNewProductsFromSheets(catalogProducts);
		}

		const inventoryMap = new Map(wrikeInventory.map((inv) => [inv.productId, inv]));
		const mergedProducts = catalogProducts.map((product) => {
			const inventory = inventoryMap.get(product.id);
			if (inventory) {
				return {
					...product,
					stock: inventory.stock,
					cost: inventory.cost,
					supplier: inventory.supplier,
					supplierSku: inventory.supplierSku,
					reorderPoint: inventory.reorderPoint,
					reorderQuantity: inventory.reorderQuantity,
				};
			}
			return product;
		});

		return NextResponse.json({ ok: true, items: mergedProducts });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to read stock';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}

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
		const lowStock = items.filter((item) => item.status === 'published' && Number(item.stock) <= LOW_STOCK_THRESHOLD);
		await sendLowStockAlert(lowStock);
		return NextResponse.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to update stock';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
