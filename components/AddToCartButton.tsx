'use client';

import { useCart } from '@/context/CartContext';
import type { Product } from '@/types/product';
import { ShoppingCart } from 'lucide-react';

type AddToCartButtonProps = {
	product: Product;
	quantity?: number;
	disabled?: boolean;
};

export default function AddToCartButton({ product, quantity = 1, disabled }: AddToCartButtonProps) {
	const { addToCart } = useCart();

	return (
		<button
			onClick={() => {
				addToCart(product, quantity);
			}}
			disabled={disabled}
			className='inline-flex min-h-[4.75rem] w-full items-center justify-center gap-4 rounded-xl bg-gradient-to-br from-deep-tidal-teal to-deep-tidal-teal-700 px-6 py-4 text-lg font-bold text-mineral-white shadow-lg shadow-deep-tidal-teal/20 transition-colors duration-200 hover:from-deep-tidal-teal-600 hover:to-deep-tidal-teal-800 disabled:cursor-not-allowed disabled:from-muted-sage-400 disabled:to-muted-sage-500 disabled:shadow-none'>
						<ShoppingCart className='h-8 w-8' />
			<span>Add to Cart</span>
		</button>
	);
}
