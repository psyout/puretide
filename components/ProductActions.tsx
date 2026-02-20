'use client';

import { useState } from 'react';
import type { Product } from '@/types/product';
import AddToCartButton from './AddToCartButton';
import BuyNowButton from './BuyNowButton';

type ProductActionsProps = {
	product: Product;
};

export default function ProductActions({ product }: ProductActionsProps) {
	const [quantity, setQuantity] = useState(1);
	const isSoldOut = product.stock <= 0 || product.status === 'stock-out';

	const handleQuantityChange = (newQuantity: number) => {
		if (newQuantity < 1) return;
		if (newQuantity > product.stock && product.stock > 0) return;
		setQuantity(newQuantity);
	};

	return (
		<div className='space-y-6'>
			{!isSoldOut && (
				<div className='flex items-center gap-4'>
					<p className='text-sm text-deep-tidal-teal-600 order-2'>Quantity</p>
					<div className='flex items-center bg-white ui-border rounded-lg overflow-hidden shadow-sm'>
						<button
							onClick={() => handleQuantityChange(quantity - 1)}
							className='px-4 py-2 hover:bg-deep-tidal-teal-100 text-deep-tidal-teal-800 transition-colors border-r ui-border'
							type='button'>
							-
						</button>
						<div className='px-6 py-2 font-bold text-deep-tidal-teal-800 min-w-[3rem] text-center'>{quantity}</div>
						<button
							onClick={() => handleQuantityChange(quantity + 1)}
							className='px-4 py-2 hover:bg-deep-tidal-teal-100 text-deep-tidal-teal-800 transition-colors border-l ui-border'
							type='button'>
							+
						</button>
					</div>
				</div>
			)}

			<div className='flex flex-row xs:flex-col sm:flex-row gap-4'>
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
