export interface Product {
	id: string;
	slug: string;
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
	status?: 'published' | 'draft' | 'inactive' | 'stock-out';
	cost?: number;
	supplier?: string;
	supplierSku?: string;
	reorderPoint?: number;
	reorderQuantity?: number;
}

export interface PromoCode {
	code: string;
	discount: number; // percentage, e.g., 10 for 10%
	freeShipping?: boolean;
	active: boolean;
}

export interface CartItem extends Product {
	quantity: number;
}
