export interface ProductVariant {
	key: string;
	label: string;
	price: number;
	stock: number;
}

export interface Product {
	id: string;
	slug: string;
	zohoItemId?: string;
	sku?: string;
	name: string;
	subtitle?: string;
	description: string;
	details?: string;
	icons?: string[];
	price: number;
	stock: number;
	image: string;
	category: string;
	mg?: string;
	purity?: string;
	coaFile?: string;
	status?: 'published' | 'draft' | 'inactive' | 'stock-out';
	displayOrder?: number;
	cost?: number;
	supplier?: string;
	supplierSku?: string;
	reorderPoint?: number;
	reorderQuantity?: number;
	variants?: ProductVariant[];
	// Variant columns from Google Sheet (for stock decrement)
	price_1?: number;
	mg_1?: string;
	stock_1?: number;
	price_2?: number;
	mg_2?: string;
	stock_2?: number;
}

export interface PromoCode {
	code: string;
	discount: number; // percentage, e.g., 10 for 10%
	/** Inclusive promotion start date in YYYY-MM-DD format (Vancouver time). */
	startDate?: string;
	/** Inclusive promotion end date in YYYY-MM-DD format (Vancouver time). */
	endDate?: string;
	minimumSubtotal?: number;
	freeShipping?: boolean;
	/** Product IDs eligible for the discount. Empty/omitted means all products. */
	productIds?: string[];
	/** Display name used in affiliate payout reports. */
	affiliateName?: string;
	/** Percentage of discounted merchandise revenue owed to the affiliate. */
	commissionPercentage?: number;
	active: boolean;
}

export interface PromotionTier {
	minimumOrderAmount: number;
	discountPercentage: number;
	promoCode: string;
	displayOrder: number;
}

export interface PromotionCampaign {
	id: string;
	title: string;
	subtitle?: string;
	message?: string;
	backgroundImage?: string;
	active: boolean;
	displayOrder: number;
	startDate?: string;
	endDate?: string;
	tiers: PromotionTier[];
}

export interface CartItem extends Product {
	quantity: number;
}
