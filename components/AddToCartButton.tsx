'use client';

import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import type { Product } from '@/types/product';

type AddToCartButtonProps = {
	product: Product;
	disabled?: boolean;
};

export default function AddToCartButton({ product, disabled }: AddToCartButtonProps) {
	const router = useRouter();
	const { addToCart } = useCart();

	return (
		<button
			onClick={() => {
				addToCart(product);
				router.push('/cart');
			}}
			disabled={disabled}
			className='w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 disabled:bg-muted-sage-400 text-mineral-white font-semibold py-4 px-6 rounded transition-colors text-lg'>
			{disabled ? 'Sold out' : 'Add to Cart'}
		</button>
	);
}
