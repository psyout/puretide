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
			type='button'
			onClick={() => {
				addToCart(product, quantity);
			}}
			disabled={disabled}
			className='site-cta cta-primary min-h-12 w-full gap-1.5 px-3 py-3 text-[clamp(0.625rem,3vw,0.75rem)] font-bold min-[401px]:gap-2 min-[401px]:px-6 min-[401px]:text-sm'>
			<ShoppingCart
				className='h-4 w-4 shrink-0 min-[401px]:h-[18px] min-[401px]:w-[18px]'
				strokeWidth={1.5}
			/>
			<span className='whitespace-nowrap'>Add to Cart</span>
		</button>
	);
}
