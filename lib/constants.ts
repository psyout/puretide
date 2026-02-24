// Shipping costs
export const SHIPPING_COSTS = {
	express: 35.0,
} as const;

/** Set NEXT_PUBLIC_DISABLE_SHIPPING_FEE=true in .env to zero shipping for real card test; remove or set false for production. */
export const DISABLE_SHIPPING_FEE_FOR_TEST = process.env.NEXT_PUBLIC_DISABLE_SHIPPING_FEE === 'true';

export function getEffectiveShippingCost(): number {
	return DISABLE_SHIPPING_FEE_FOR_TEST ? 0 : SHIPPING_COSTS.express;
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
