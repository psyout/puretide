export interface Product {
	id: string;
	slug: string;
	name: string;
	description: string;
	details?: string;
	icons?: string[];
	price: number;
	image: string;
	category: string;
}

export interface CartItem extends Product {
	quantity: number;
}
