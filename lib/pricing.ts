import { DISCOUNT_TIERS } from './constants';

/**
 * Calculate the discount for a given quantity
 */
export function getQuantityDiscount(quantity: number): number {
	for (const tier of DISCOUNT_TIERS) {
		if (quantity >= tier.minQty) {
			return tier.discount;
		}
	}
	return 0;
}

/**
 * Calculate the unit price after quantity discount
 */
export function getDiscountedPrice(basePrice: number, quantity: number): number {
	const discount = getQuantityDiscount(quantity);
	return basePrice * (1 - discount);
}
