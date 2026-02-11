// Shipping costs
export const SHIPPING_COSTS = {
	express: 35.0,
} as const;

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
