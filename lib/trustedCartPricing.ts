import type { Product } from '@/types/product';

type CartItemWithPrice = {
	id: string | number;
	price: number;
	quantity: number;
};

type NormalizedResult<T> = { ok: true; items: T[] } | { ok: false; error: string };

export function normalizeCartItemsWithTrustedPrices<T extends CartItemWithPrice>(cartItems: T[], products: Product[]): NormalizedResult<T> {
	const normalized = cartItems.map((item) => {
		// Check if this is a variant ID (contains dash)
		const isVariant = String(item.id).includes('-');
		let productPrice = 0;

		if (isVariant) {
			// Extract base product ID (before the dash)
			const baseId = String(item.id).split('-')[0];
			const product = products.find((p) => p.id === baseId || p.slug === baseId);
			if (!product) {
				return null;
			}
			// Find the variant in the product's variants array
			const variant = product.variants?.find((v) => v.key === String(item.id));
			if (!variant) {
				return null;
			}
			productPrice = Number(variant.price) || 0;
		} else {
			// Regular product lookup
			const product = products.find((p) => String(item.id) === p.id || String(item.id) === p.slug);
			if (!product) {
				return null;
			}
			productPrice = Number(product.price) || 0;
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
