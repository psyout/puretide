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
			type='button'
			onClick={handleBuyNow}
			disabled={disabled}
			className='group inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-lg border border-deep-tidal-teal/20 bg-white px-3 py-3 text-[clamp(0.625rem,3vw,0.75rem)] font-bold uppercase tracking-wide text-deep-tidal-teal-800 shadow-sm shadow-deep-tidal-teal/5 transition-all hover:-translate-y-px hover:border-deep-tidal-teal/35 hover:bg-eucalyptus-50 hover:text-deep-tidal-teal hover:shadow-md hover:shadow-deep-tidal-teal/10 active:translate-y-0 disabled:cursor-not-allowed disabled:border-muted-sage-300 disabled:bg-muted-sage-100 disabled:text-muted-sage-500 disabled:shadow-none min-[401px]:gap-2 min-[401px]:px-4 min-[401px]:text-sm'>
			<Zap className='h-4 w-4 shrink-0 transition-transform group-hover:scale-110 min-[401px]:h-[18px] min-[401px]:w-[18px]' strokeWidth={1.75} />
			<span className='whitespace-nowrap'>Buy Now</span>
		</button>
	);
}
