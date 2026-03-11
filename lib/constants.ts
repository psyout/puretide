// Shipping costs
export const SHIPPING_COSTS = {
	western: 20.0,
	eastern: 30.0,
} as const;

export const FREE_SHIPPING_THRESHOLD = 400;

/** Set NEXT_PUBLIC_DISABLE_SHIPPING_FEE=true in .env to zero shipping for real card test; remove or set false for production. */
export const DISABLE_SHIPPING_FEE_FOR_TEST = process.env.NEXT_PUBLIC_DISABLE_SHIPPING_FEE === 'true';

/** Set NEXT_PUBLIC_ENABLE_CREDIT_CARD=false to hide credit card and force e-transfer (e.g. when DigiPay has issues). Omit or true = credit card enabled. */
export const ENABLE_CREDIT_CARD = process.env.NEXT_PUBLIC_ENABLE_CREDIT_CARD !== 'false';

export function getEffectiveShippingCost(postalCode?: string): number {
	if (DISABLE_SHIPPING_FEE_FOR_TEST) return 0;
	if (!postalCode) return SHIPPING_COSTS.eastern; // default to eastern if no postal code
	const firstLetter = postalCode.trim().toUpperCase().charAt(0);
	return ['V', 'R', 'S', 'T'].includes(firstLetter) ? SHIPPING_COSTS.western : SHIPPING_COSTS.eastern;
}

// Stock alert threshold
export const LOW_STOCK_THRESHOLD = 5;

// Default email addresses
export const DEFAULT_ALERT_EMAIL = 'info@puretide.ca';
export const DEFAULT_ORDER_NOTIFICATION_EMAIL = 'orders@puretide.ca';

// Discount tiers based on quantity
export const DISCOUNT_TIERS = [
	{ minQty: 10, discount: 0.25 },
	{ minQty: 8, discount: 0.15 },
	{ minQty: 6, discount: 0.1 },
	{ minQty: 2, discount: 0.05 },
] as const;
