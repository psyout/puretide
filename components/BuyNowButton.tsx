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
		addToCart(product, quantity);
		router.push('/checkout');
	};

	return (
		<button
			onClick={handleBuyNow}
			disabled={disabled}
			className='inline-flex min-h-[4.75rem] w-full items-center justify-center gap-4 rounded-xl bg-gradient-to-br from-deep-tidal-teal-900 to-deep-tidal-teal-800 px-6 py-4 text-lg font-bold text-mineral-white shadow-md transition-colors duration-200 hover:from-slate-700 hover:to-slate-800 disabled:cursor-not-allowed disabled:from-muted-sage-400 disabled:to-muted-sage-500'>
						<Zap className='h-8 w-8 fill-[#f4c454] text-[#f4c454]' />
			<span>Buy Now</span>
		</button>
	);
}
