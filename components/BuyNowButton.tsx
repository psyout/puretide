'use client';

import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import type { Product } from '@/types/product';
import { Zap } from 'lucide-react';

type BuyNowButtonProps = {
	product: Product;
	quantity?: number;
	disabled?: boolean;
};

export default function BuyNowButton({ product, quantity = 1, disabled }: BuyNowButtonProps) {
	const router = useRouter();
	const { addToCart } = useCart();

	const handleBuyNow = () => {
		addToCart(product, quantity, { openDrawer: false });
		router.push('/checkout');
	};

	return (
		<button
			onClick={handleBuyNow}
			disabled={disabled}
			className='site-cta min-h-[4.75rem] w-full border-2 border-deep-tidal-teal/20 bg-white text-md font-bold text-deep-tidal-teal-800 shadow-sm hover:border-deep-tidal-teal/40 hover:bg-eucalyptus-50 disabled:cursor-not-allowed disabled:border-muted-sage-300 disabled:bg-muted-sage-100 disabled:text-muted-sage-500'>
			<Zap className='h-5 w-5' />
			<span>Buy Now</span>
		</button>
	);
}
