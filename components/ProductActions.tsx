'use client';

import { useState } from 'react';
import type { Product } from '@/types/product';
import AddToCartButton from './AddToCartButton';
import BuyNowButton from './BuyNowButton';

type ProductActionsProps = {
	product: Product;
};

export default function ProductActions({ product }: ProductActionsProps) {
	const stock = Number(product.stock) || 0;
	const [quantity, setQuantity] = useState(1);
	const isSoldOut = stock <= 0 || product.status === 'stock-out';

	const handleQuantityChange = (newQuantity: number) => {
		if (newQuantity < 1) return;
		if (stock > 0 && newQuantity > stock) return;
		setQuantity(newQuantity);
	};

	return (
		<div className='space-y-5'>
			{!isSoldOut && (
				<div className='flex flex-wrap items-center gap-5'>
					<div className='flex min-h-[3.75rem] items-center overflow-hidden rounded-xl border border-deep-tidal-teal/15 bg-white shadow-sm shadow-deep-tidal-teal/5'>
						<button
							onClick={() => handleQuantityChange(quantity - 1)}
							className='flex h-[3.75rem] w-16 items-center justify-center text-2xl font-semibold text-deep-tidal-teal-800 transition-colors hover:bg-deep-tidal-teal/10 active:bg-deep-tidal-teal/15 disabled:cursor-not-allowed disabled:opacity-40'
							disabled={quantity <= 1}
							aria-label='Decrease quantity'
							type='button'>
							−
						</button>
						<div className='flex h-[3.75rem] min-w-[4.75rem] items-center justify-center border-x border-deep-tidal-teal/10 px-5 text-lg font-bold text-deep-tidal-teal-900'>{quantity}</div>
						<button
							onClick={() => handleQuantityChange(quantity + 1)}
							className='flex h-[3.75rem] w-16 items-center justify-center text-2xl font-semibold text-deep-tidal-teal-800 transition-colors hover:bg-deep-tidal-teal/10 active:bg-deep-tidal-teal/15 disabled:cursor-not-allowed disabled:opacity-40'
							disabled={stock > 0 && quantity >= stock}
							aria-label='Increase quantity'
							type='button'>
							+
						</button>
					</div>
					<p className='text-sm font-medium text-deep-tidal-teal-700'>Quantity</p>
				</div>
			)}

			<div className='flex flex-col sm:flex-row gap-4'>
				<div className='flex-1'>
					<AddToCartButton
						product={product}
						quantity={quantity}
						disabled={isSoldOut}
					/>
				</div>
				<div className='flex-1'>
					<BuyNowButton
						product={product}
						quantity={quantity}
						disabled={isSoldOut}
					/>
				</div>
			</div>
		</div>
	);
}
