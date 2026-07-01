import type { PromoCode } from '@/types/product';

export function getPromoMinimumSubtotalError(params: { promo: PromoCode; subtotal: number }): string | null {
	const { promo, subtotal } = params;
	const minimumSubtotal = Number(promo.minimumSubtotal ?? 0);
	if (!Number.isFinite(minimumSubtotal) || minimumSubtotal <= 0) return null;
	if (subtotal >= minimumSubtotal) return null;
	return `${promo.code} requires a minimum order of $${minimumSubtotal}.`;
}
