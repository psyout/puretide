import type { Product } from '@/types/product';

type CartItemWithPrice = {
	id: string | number;
	price: number;
	quantity: number;
};

type NormalizedResult<T> = { ok: true; items: T[] } | { ok: false; error: string };

export function normalizeCartItemsWithTrustedPrices<T extends CartItemWithPrice>(cartItems: T[], products: Product[]): NormalizedResult<T> {
	const normalized = cartItems.map((item) => {
		const product = products.find((p) => String(item.id) === p.id || String(item.id) === p.slug);
		if (!product) {
			return null;
		}
		return {
			...item,
			price: Number(product.price) || 0,
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
