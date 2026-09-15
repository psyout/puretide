import type { PromoCode } from '@/types/product';

type PromoCartItem = { id: string | number; price: number; quantity: number };

export function getPromoEligibleSubtotal(promo: PromoCode, items: PromoCartItem[]): number {
	const eligibleIds = new Set((promo.productIds ?? []).map(String));
	return items.reduce((subtotal, item) => {
		if (!eligibleIds.has(String(item.id))) return subtotal;
		return subtotal + item.price * item.quantity;
	}, 0);
}

export function getPromoDiscountAmount(promo: PromoCode, items: PromoCartItem[]): number {
	return Number((getPromoEligibleSubtotal(promo, items) * (promo.discount / 100)).toFixed(2));
}

export function getPromoProductEligibilityError(promo: PromoCode, items: PromoCartItem[]): string | null {
	if (promo.discount <= 0 || getPromoEligibleSubtotal(promo, items) > 0) return null;
	return `${promo.code} does not apply to the products in your cart.`;
}

export function getPromoMinimumSubtotalError(params: { promo: PromoCode; subtotal: number }): string | null {
	const { promo, subtotal } = params;
	const minimumSubtotal = Number(promo.minimumSubtotal ?? 0);
	if (!Number.isFinite(minimumSubtotal) || minimumSubtotal <= 0) return null;
	if (subtotal >= minimumSubtotal) return null;
	return `${promo.code} requires a minimum order of $${minimumSubtotal}.`;
}
