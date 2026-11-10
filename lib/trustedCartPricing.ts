import type { Product } from '@/types/product';
import { products as baseProducts } from '@/lib/products';
import { isProductVariantSellable } from '@/lib/productVariant';

type CartItemWithPrice = {
	id: string | number;
	price: number;
	quantity: number;
	mg?: string;
};

type NormalizedResult<T> = { ok: true; items: T[] } | { ok: false; error: string };

export function normalizeCartItemsWithTrustedPrices<T extends CartItemWithPrice>(cartItems: T[], products: Product[]): NormalizedResult<T> {
	const normalized = cartItems.map((item) => {
		const itemId = String(item.id);
		let productPrice = 0;
		let resolvedId = itemId;
		let resolvedStrength = item.mg;

		const normalizeKey = (value: string) =>
			String(value ?? '')
				.trim()
				.toLowerCase()
				.replace(/\s+/g, ' ');

		const resolveProduct = (): Product | null => {
			// 1) Canonical match by id/slug
			const direct = products.find((p) => itemId === p.id || itemId === p.slug);
			if (direct) {
				resolvedId = direct.id;
				return direct;
			}

			// 2) Back-compat: numeric IDs from legacy baseProducts -> resolve by slug
			const legacy = baseProducts.find((p) => String(p.id) === itemId);
			if (legacy?.slug) {
				const bySlug = products.find((p) => legacy.slug === p.id || legacy.slug === p.slug);
				if (bySlug) {
					resolvedId = bySlug.id;
					return bySlug;
				}
			}

			// 3) Temporary back-compat: match by normalized name (if present on cart item)
			const maybeName = (item as unknown as { name?: unknown }).name;
			if (typeof maybeName === 'string' && maybeName.trim()) {
				const n = normalizeKey(maybeName);
				const byName = products.find((p) => normalizeKey(p.name) === n);
				if (byName) {
					resolvedId = byName.id;
					return byName;
				}
			}

			return null;
		};

		// First, try exact match (regular product)
		const product = resolveProduct();

		if (product) {
			if ((product.status ?? 'published') !== 'published') return null;
			// Regular product found - use its price
			productPrice = Number(product.price) || 0;
			resolvedStrength = product.mg ?? resolvedStrength;
		} else {
			const baseProduct = products.find((candidate) => candidate.variants?.some((variant) => variant.key === itemId));
			if (!baseProduct) return null;
			if ((baseProduct.status ?? 'published') !== 'published') return null;
			const variant = baseProduct.variants?.find((v) => v.key === itemId);
			if (variant && isProductVariantSellable(variant)) {
				productPrice = Number(variant.price) || 0;
				resolvedId = variant.key;
				resolvedStrength = variant.label;
			} else return null;
		}

		return {
			...item,
			id: resolvedId,
			price: productPrice,
			...(resolvedStrength ? { mg: resolvedStrength } : {}),
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
