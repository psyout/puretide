import { Product } from '@/types/product';
import { products } from './products';

export interface CrossSellProduct {
	id: string;
	name: string;
	price: number;
	originalPrice?: number;
	image: string;
	description: string;
	category: string;
	savings?: string;
	stock: number;
	slug: string;
	subtitle?: string;
	details?: string;
	icons?: string[];
	mg?: string;
	status: 'published' | 'draft' | 'inactive' | 'stock-out';
}

// Get Bacteriostatic Water from the products array
const bacteriostaticWater = products.find((p) => p.slug === 'bacteriostatic-water')!;

export const crossSellProducts: CrossSellProduct[] = [
	{
		...bacteriostaticWater,
		status: bacteriostaticWater.status || 'published',
		description: 'Sterile water with 0.9% benzyl alcohol for reconstituting peptides.',
		icons: bacteriostaticWater.icons || [],
	},
];
