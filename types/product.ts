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
	status?: 'published' | 'draft' | 'inactive' | 'stock-out';
}

export interface CartItem extends Product {
	quantity: number;
}
