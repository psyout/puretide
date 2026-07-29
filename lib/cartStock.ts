import type { CartItem, Product } from '@/types/product';

const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

export function buildCartStockMap(products: Product[]): Map<string, number> {
	const stockMap = new Map<string, number>();

	for (const product of products) {
		const stock = Number(product.stock) || 0;
		stockMap.set(product.id, stock);
		if (product.slug) stockMap.set(product.slug, stock);
		if (product.name) stockMap.set(`name:${normalizeName(product.name)}`, stock);

		for (const variant of product.variants ?? []) {
			stockMap.set(variant.key, Number(variant.stock) || 0);
		}
	}

	return stockMap;
}

export function resolveCartItemStock(stockMap: Map<string, number>, item: Pick<CartItem, 'id' | 'slug' | 'name' | 'stock'>): number | null {
	const liveStock = stockMap.get(item.id) ?? stockMap.get(item.slug) ?? stockMap.get(`name:${normalizeName(item.name)}`);
	return liveStock ?? null;
}

export function hasInvalidCartQuantity(
	stockMap: Map<string, number>,
	items: Array<Pick<CartItem, 'id' | 'slug' | 'name' | 'stock' | 'quantity'>>,
	stockUnavailable: boolean,
): boolean {
	// A temporary inventory outage must not turn every unknown item into zero stock.
	// The order API still performs the authoritative stock check before accepting payment.
	if (stockUnavailable) return false;

	return items.some((item) => {
		const availableStock = resolveCartItemStock(stockMap, item);
		return availableStock == null || item.quantity > availableStock;
	});
}
