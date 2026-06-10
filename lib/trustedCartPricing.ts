import type { Product } from '@/types/product';

type CartItemWithPrice = {
	id: string | number;
	price: number;
	quantity: number;
};

type NormalizedResult<T> = { ok: true; items: T[] } | { ok: false; error: string };

export function normalizeCartItemsWithTrustedPrices<T extends CartItemWithPrice>(cartItems: T[], products: Product[]): NormalizedResult<T> {
	const normalized = cartItems.map((item) => {
		const itemId = String(item.id);
		let productPrice = 0;

		// First, try exact match (regular product)
		const product = products.find((p) => itemId === p.id || itemId === p.slug);

		if (product) {
			// Regular product found - use its price
			productPrice = Number(product.price) || 0;
		} else if (itemId.includes('-')) {
			// Not found as regular product, try parsing as variant
			// Extract base product ID (all segments except last, for IDs like "MOTS-C-40")
			const parts = itemId.split('-').filter(Boolean);
			const baseId = parts.length > 1 ? parts.slice(0, -1).join('-') : itemId;
			const baseProduct = products.find((p) => p.id === baseId || p.slug === baseId);
			if (!baseProduct) {
				return null;
			}
			// Try to find variant in variants array
			const variant = baseProduct.variants?.find((v) => v.key === itemId);
			if (variant) {
				productPrice = Number(variant.price) || 0;
			} else {
				// Fallback: use base product price
				productPrice = Number(baseProduct.price) || 0;
			}
		} else {
			// Not found at all
			return null;
		}

		return {
			...item,
			price: productPrice,
		};
	});

	if (normalized.some((item) => item == null)) {
		return { ok: false, error: 'One or more cart items are no longer available.' };
	}

	return {
		ok: true,
		items: normalized as T[],
	};
}
