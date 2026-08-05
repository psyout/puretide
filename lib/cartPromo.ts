export const CART_PROMO_STORAGE_KEY = 'privacy-shop-applied-promo';

export type StoredCartPromo = {
	code: string;
	discount: number;
	freeShipping: boolean;
};

export function readStoredCartPromo(): StoredCartPromo | null {
	if (typeof window === 'undefined') return null;
	try {
		const value = sessionStorage.getItem(CART_PROMO_STORAGE_KEY);
		if (!value) return null;
		const parsed = JSON.parse(value) as Partial<StoredCartPromo>;
		if (typeof parsed.code !== 'string' || !parsed.code.trim()) return null;
		return {
			code: parsed.code.trim().toUpperCase(),
			discount: Number(parsed.discount) || 0,
			freeShipping: Boolean(parsed.freeShipping),
		};
	} catch {
		return null;
	}
}

export function storeCartPromo(promo: StoredCartPromo | null) {
	if (typeof window === 'undefined') return;
	if (promo) {
		sessionStorage.setItem(CART_PROMO_STORAGE_KEY, JSON.stringify(promo));
	} else {
		sessionStorage.removeItem(CART_PROMO_STORAGE_KEY);
	}
}
