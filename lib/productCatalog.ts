import type { Product } from '@/types/product';
import { readSheetProducts, writeSheetProducts } from '@/lib/stockSheet';
import { readZohoProducts } from '@/lib/zohoInventory';

export type ProductSource = 'sheet' | 'zoho';

export function getProductSource(): ProductSource {
	return String(process.env.PRODUCT_SOURCE ?? 'sheet').trim().toLowerCase() === 'zoho' ? 'zoho' : 'sheet';
}

export function isZohoProductSource() {
	return getProductSource() === 'zoho';
}

export async function readProducts(): Promise<Product[]> {
	return isZohoProductSource() ? readZohoProducts() : readSheetProducts();
}

export async function writeProducts(items: Product[]): Promise<void> {
	if (isZohoProductSource()) {
		throw new Error('Product editing is disabled in the website dashboard while Zoho Inventory is the product source. Edit products directly in Zoho.');
	}
	await writeSheetProducts(items);
}
