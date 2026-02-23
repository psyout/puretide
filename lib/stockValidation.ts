import type { Product } from '@/types/product';

export function validateStockItems(items: unknown): { valid: true; items: Product[] } | { valid: false; error: string } {
	if (!Array.isArray(items) || items.length === 0) {
		return { valid: false, error: 'items must be a non-empty array.' };
	}
	const MAX_STOCK = 999999;
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (!item || typeof item !== 'object') {
			return { valid: false, error: `items[${i}] must be an object.` };
		}
		if (typeof (item as Product).id !== 'string' || !(item as Product).id.trim()) {
			return { valid: false, error: `items[${i}] must have a non-empty id.` };
		}
		if (typeof (item as Product).slug !== 'string' || !(item as Product).slug.trim()) {
			return { valid: false, error: `items[${i}] must have a non-empty slug.` };
		}
		const stock = Number((item as Product).stock);
		if (Number.isNaN(stock) || stock < 0 || stock > MAX_STOCK) {
			return { valid: false, error: `items[${i}] stock must be a number between 0 and ${MAX_STOCK}.` };
		}
	}
	return { valid: true, items: items as Product[] };
}
