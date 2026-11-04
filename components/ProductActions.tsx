'use client';

import { useEffect, useState } from 'react';
import type { Product } from '@/types/product';
import AddToCartButton from './AddToCartButton';
import BuyNowButton from './BuyNowButton';
import { Minus, Plus } from 'lucide-react';

type ProductActionsProps = {
	product: Product;
};

export default function ProductActions({ product }: ProductActionsProps) {
	const stock = Number(product.stock) || 0;
	const [quantity, setQuantity] = useState(1);
	const isSoldOut = stock <= 0 || product.status === 'stock-out';

	useEffect(() => {
		setQuantity((currentQuantity) => (stock > 0 ? Math.min(currentQuantity, stock) : 1));
	}, [product.id, stock]);

	const handleQuantityChange = (newQuantity: number) => {
		if (newQuantity < 1) return;
		if (stock > 0 && newQuantity > stock) return;
		setQuantity(newQuantity);
	};

	return (
		<div className='space-y-4'>
			{!isSoldOut && (
				<div className='flex flex-wrap items-center gap-3'>
					<p className='text-sm font-medium text-deep-tidal-teal-700'>Quantity</p>
					<div className='flex min-h-11 items-center overflow-hidden rounded-xl border border-deep-tidal-teal/15 bg-white shadow-sm shadow-deep-tidal-teal/5'>
						<button
							onClick={() => handleQuantityChange(quantity - 1)}
							className='flex h-11 w-12 items-center justify-center text-deep-tidal-teal-800 transition-colors hover:bg-deep-tidal-teal/10 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-deep-tidal-teal/40 active:bg-deep-tidal-teal/15 disabled:cursor-not-allowed disabled:opacity-40'
							disabled={quantity <= 1}
							aria-label='Decrease quantity'
							type='button'>
							<Minus className='h-4 w-4' aria-hidden='true' />
						</button>
						<div className='flex h-11 min-w-14 items-center justify-center border-x border-deep-tidal-teal/10 px-3 text-base font-bold text-deep-tidal-teal-900'>{quantity}</div>
						<button
							onClick={() => handleQuantityChange(quantity + 1)}
							className='flex h-11 w-12 items-center justify-center text-deep-tidal-teal-800 transition-colors hover:bg-deep-tidal-teal/10 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-deep-tidal-teal/40 active:bg-deep-tidal-teal/15 disabled:cursor-not-allowed disabled:opacity-40'
							disabled={stock > 0 && quantity >= stock}
							aria-label='Increase quantity'
							type='button'>
							<Plus className='h-4 w-4' aria-hidden='true' />
						</button>
					</div>
				</div>
			)}

			<div className='grid grid-cols-1 gap-2 min-[350px]:grid-cols-2'>
				<div className='min-w-0'>
					<AddToCartButton
						product={product}
						quantity={quantity}
						disabled={isSoldOut}
					/>
				</div>
				<div className='min-w-0'>
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
