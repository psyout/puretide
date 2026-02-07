'use client';

import { useCart } from '@/context/CartContext';
import type { Product } from '@/types/product';

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
			className='w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 disabled:bg-muted-sage-400 text-mineral-white font-semibold py-4 px-6 rounded transition-colors text-lg'>
			Add to Cart
		</button>
	);
}
