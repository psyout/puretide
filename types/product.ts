export interface Product {
	id: string;
	slug: string;
	name: string;
	description: string;
	details?: string;
	icons?: string[];
	price: number;
	stock: number;
	image: string;
	category: string;
	mg?: string;
	status?: 'published' | 'draft' | 'inactive' | 'stock-out';
}

export interface PromoCode {
	code: string;
	discount: number; // percentage, e.g., 10 for 10%
	active: boolean;
}

export interface CartItem extends Product {
	quantity: number;
}
