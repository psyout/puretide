import { NextResponse } from 'next/server';
import { isZohoProductSource, readProducts, writeProducts } from '@/lib/productCatalog';
import { validateStockItems } from '@/lib/stockValidation';
import { sendLowStockAlert } from '@/lib/email';
import { getAllProductInventory, syncNewProductsFromSheets } from '@/lib/wrikeProducts';
import type { Product } from '@/types/product';

const LOW_STOCK_THRESHOLD = 5;

function requireStockReadKey(request: Request): boolean {
	const key = process.env.STOCK_API_KEY;
	if (!key) {
		return process.env.NODE_ENV !== 'production';
	}
	const provided =
		request.headers.get('x-api-key') ??
		request.headers
			.get('authorization')
			?.replace(/^Bearer\s+/i, '')
			.trim();
	return provided === key;
}

export async function GET(request: Request) {
	if (!requireStockReadKey(request)) {
		return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}
	try {
		const catalogProducts = await readProducts();

		const wrikeInventory = await getAllProductInventory();

		if (!isZohoProductSource() && wrikeInventory.length > 0) {
			await syncNewProductsFromSheets(catalogProducts);
		}

		const inventoryMap = new Map(wrikeInventory.map((inv) => [inv.productId, inv]));

		const mergedProducts = catalogProducts.map((product) => {
			const inventory = inventoryMap.get(product.id);
			if (inventory) {
				const zohoIsSource = isZohoProductSource();
				return {
					...product,
					stock: zohoIsSource ? product.stock : inventory.stock,
					cost: zohoIsSource ? product.cost : inventory.cost,
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

		await writeProducts(items);

		const lowStock = items.filter((item) => item.status === 'published' && Number(item.stock) <= LOW_STOCK_THRESHOLD);

		await sendLowStockAlert(lowStock);

		return NextResponse.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to update stock';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
