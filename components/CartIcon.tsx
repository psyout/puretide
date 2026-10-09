'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';

export default function CartIcon() {
	const { cartItems, getItemPrice, getTotal, openCartDrawer } = useCart();
	const pathname = usePathname();
	const [mounted, setMounted] = useState(false);
	const [isAnimate, setIsAnimate] = useState(false);
	const [isPreviewOpen, setIsPreviewOpen] = useState(false);
	const prevCountRef = useRef(0);
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
	const isCartPage = pathname === '/cart';

	useEffect(() => {
		setMounted(true);
		prevCountRef.current = cartItems.reduce((sum, item) => sum + item.quantity, 0);
	}, []);

	useEffect(() => {
		if (mounted && itemCount > prevCountRef.current) {
			setIsAnimate(true);
			const timer = setTimeout(() => setIsAnimate(false), 600);
			prevCountRef.current = itemCount;
			return () => clearTimeout(timer);
		}
		prevCountRef.current = itemCount;
	}, [itemCount, mounted]);

	useEffect(
		() => () => {
			if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		},
		[],
	);

	const openPreview = () => {
		if (isCartPage) return;
		if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
		setIsPreviewOpen(true);
	};

	const schedulePreviewClose = () => {
		closeTimerRef.current = setTimeout(() => setIsPreviewOpen(false), 140);
	};

	return (
		<div
			className='relative'
			onMouseEnter={openPreview}
			onMouseLeave={schedulePreviewClose}>
			<button
				type='button'
				onClick={() => {
					setIsPreviewOpen(false);
					openCartDrawer();
				}}
				onFocus={openPreview}
				aria-label={`Open cart${itemCount > 0 ? `, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : ''}`}
				aria-haspopup='dialog'
				className='relative inline-flex items-center justify-center transition-colors duration-300'>
				<svg
					className={`h-6 w-6 transition-colors duration-300 ${isAnimate ? 'text-eucalyptus-500' : 'text-current'}`}
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'
					aria-hidden='true'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z'
					/>
				</svg>
				{mounted && itemCount > 0 && (
					<span
						key={itemCount}
						className={`absolute right-0 top-0 z-10 flex h-4 w-4 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-mineral-white text-[11px] font-bold text-deep-tidal-teal shadow-sm transition-colors duration-300 ${isAnimate ? 'bg-eucalyptus-500 text-mineral-white' : ''}`}>
						{itemCount > 99 ? '99+' : itemCount}
					</span>
				)}
			</button>

			{!isCartPage && isPreviewOpen && (
				<div
					className='absolute right-[-1rem] top-full hidden w-[24rem] pt-5 text-left text-deep-tidal-teal-900 md:block'
					onMouseEnter={openPreview}
					onMouseLeave={schedulePreviewClose}>
					<div className='relative rounded-xl border border-deep-tidal-teal/10 bg-white p-5 shadow-[0_18px_50px_rgba(5,32,39,0.2)]'>
						<span
							className='absolute -top-2 right-[1.1rem] h-4 w-4 rotate-45 border-l border-t border-deep-tidal-teal/10 bg-white'
							aria-hidden='true'
						/>
						<div className='flex items-center justify-between border-b border-deep-tidal-teal/10 pb-4'>
							<div>
								<p className='text-xs font-bold uppercase tracking-[0.16em] text-eucalyptus-600'>Your cart</p>
								<p className='mt-1 text-lg font-bold'>{itemCount === 0 ? 'Ready when you are' : `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}</p>
							</div>
							<ShoppingBag className='h-6 w-6 text-deep-tidal-teal-500' />
						</div>

						{cartItems.length === 0 ? (
							<div className='py-8 text-center'>
								<p className='text-sm text-deep-tidal-teal-600'>Your cart is currently empty.</p>
								<Link
									href='/#products'
									onClick={() => setIsPreviewOpen(false)}
									className='mt-4 inline-block text-sm font-bold text-deep-tidal-teal underline underline-offset-4'>
									Browse products
								</Link>
							</div>
						) : (
							<>
								<div className='max-h-[18rem] overflow-y-auto py-1'>
									{cartItems.slice(0, 3).map((item) => (
										<div
											key={item.id}
											className='flex gap-3 border-b border-deep-tidal-teal/10 py-4 last:border-0'>
											<div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-deep-tidal-teal/5 p-1.5'>
												{hasProductImage(item.image) ? (
													<Image
														src={item.image}
														alt=''
														width={56}
														height={56}
														unoptimized={item.image.startsWith('http')}
														className='h-full w-full object-contain'
													/>
												) : (
													<ProductImagePlaceholder className='h-full w-full' />
												)}
											</div>
											<div className='min-w-0 flex-1'>
												<p className='truncate text-sm font-bold'>{item.name}</p>
												<p className='mt-1 text-xs text-deep-tidal-teal-600'>
													{item.mg ? `${item.mg} · ` : ''}Qty {item.quantity}
												</p>
											</div>
											<p className='text-sm font-bold'>C${(getItemPrice(item) * item.quantity).toFixed(2)}</p>
										</div>
									))}
									{cartItems.length > 3 && (
										<p className='pb-3 text-center text-xs text-deep-tidal-teal-500'>
											+ {cartItems.length - 3} more {cartItems.length - 3 === 1 ? 'item' : 'items'}
										</p>
									)}
								</div>
								<div className='border-t border-deep-tidal-teal/10 pt-4'>
									<div className='mb-4 flex items-baseline justify-end gap-5'>
										<span className='text-sm text-deep-tidal-teal-600'>Subtotal</span>
										<span className='text-sm font-bold text-deep-tidal-teal-900'>C${getTotal().toFixed(2)}</span>
									</div>
									<Link
										href='/cart'
										onClick={() => setIsPreviewOpen(false)}
										className='flex min-h-11 w-full items-center justify-center rounded-lg bg-deep-tidal-teal px-4 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-deep-tidal-teal-600'>
										View cart
									</Link>
								</div>
							</>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
