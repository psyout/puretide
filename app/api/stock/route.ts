import { NextResponse } from 'next/server';
import { readSheetProducts, writeSheetProducts } from '@/lib/stockSheet';
import { validateStockItems } from '@/lib/stockValidation';
import { sendLowStockAlert } from '@/lib/email';
import { getAllProductInventory, syncNewProductsFromSheets } from '@/lib/wrikeProducts';
import type { Product } from '@/types/product';

const LOW_STOCK_THRESHOLD = 5;

export async function GET() {
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

function requireStockApiKey(request: Request): boolean {
	const key = process.env.STOCK_API_KEY;
	if (!key) return false;
	const provided =
		request.headers.get('x-api-key') ??
		request.headers
			.get('authorization')
			?.replace(/^Bearer\s+/i, '')
			.trim();
	return provided === key;
}

export async function POST(request: Request) {
	try {
		if (!requireStockApiKey(request)) {
			return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
		}

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
