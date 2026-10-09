'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';

export default function CartDrawer() {
	const { cartItems, isCartDrawerOpen, lastAddedItemId, closeCartDrawer, getItemPrice, getTotal, removeFromCart, updateQuantity } = useCart();
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
	const lastAddedItem = cartItems.find((item) => item.id === lastAddedItemId) ?? cartItems[cartItems.length - 1];

	useEffect(() => {
		if (!isCartDrawerOpen) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		closeButtonRef.current?.focus();
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeCartDrawer();
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [closeCartDrawer, isCartDrawerOpen]);

	return (
		<AnimatePresence>
			{isCartDrawerOpen && (
				<div
					className='fixed inset-0 z-[200]'
					aria-live='polite'>
					<motion.button
						type='button'
						aria-label='Close cart'
						className='absolute inset-0 h-full w-full cursor-default bg-deep-tidal-teal-900/35 backdrop-blur-[2px]'
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={closeCartDrawer}
					/>
					<motion.aside
						role='dialog'
						aria-modal='true'
						aria-labelledby='cart-drawer-title'
						initial={{ x: '100%' }}
						animate={{ x: 0 }}
						exit={{ x: '100%' }}
						transition={{ type: 'spring', damping: 30, stiffness: 300 }}
						className='absolute right-0 top-0 flex h-full w-full max-w-[31rem] flex-col bg-mineral-white shadow-2xl'>
						<div className='flex items-center justify-between border-b border-deep-tidal-teal/10 px-6 py-5 sm:px-8'>
							<div>
								<p className='text-xs font-bold uppercase tracking-[0.18em] text-eucalyptus-600'>{lastAddedItem ? 'Added to your cart' : 'Your cart'}</p>
								<h2
									id='cart-drawer-title'
									className='mt-1 text-xl font-semibold text-deep-tidal-teal-900'>
									{itemCount === 0 ? 'Your cart is empty' : `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
								</h2>
							</div>
							<button
								ref={closeButtonRef}
								type='button'
								onClick={closeCartDrawer}
								className='rounded-full p-2 text-deep-tidal-teal-800 transition hover:bg-deep-tidal-teal/10'
								aria-label='Close cart drawer'>
								<X className='h-6 w-6' />
							</button>
						</div>

						{cartItems.length === 0 ? (
							<div className='flex flex-1 flex-col items-center justify-center px-8 text-center'>
								<span className='flex h-16 w-16 items-center justify-center rounded-full bg-eucalyptus-100 text-deep-tidal-teal-700'>
									<ShoppingBag className='h-7 w-7' />
								</span>
								<p className='mt-5 text-deep-tidal-teal-600'>Add something you love and it will appear here.</p>
								<Link
									href='/#products'
									onClick={closeCartDrawer}
									className='mt-7 rounded-lg bg-deep-tidal-teal px-6 py-3 font-bold text-white transition hover:bg-deep-tidal-teal-600'>
									Start shopping
								</Link>
							</div>
						) : (
							<>
								<div className='flex-1 overflow-y-auto px-6 py-2 sm:px-8'>
									{cartItems.map((item) => {
										const itemPrice = getItemPrice(item);
										return (
											<div
												key={item.id}
												className={`flex gap-4 border-b py-6 ${item.id === lastAddedItem?.id ? 'border-eucalyptus-300' : 'border-deep-tidal-teal/10'}`}>
												<Link
													href={`/product/${item.slug || item.id}`}
													onClick={closeCartDrawer}
													className='flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-deep-tidal-teal/5 p-2'>
													{hasProductImage(item.image) ? (
														<Image
															src={item.image}
															alt={item.name}
															width={88}
															height={88}
															unoptimized={item.image.startsWith('http')}
															className='h-full w-full object-contain'
														/>
													) : (
														<ProductImagePlaceholder className='h-full w-full' />
													)}
												</Link>
												<div className='min-w-0 flex-1'>
													<div className='flex items-start justify-between gap-3'>
														<div>
															<h3 className='font-semibold leading-tight text-deep-tidal-teal-900'>{item.name}</h3>
															{item.mg && <p className='mt-1 text-sm text-deep-tidal-teal-600'>{item.mg}</p>}
														</div>
														<button
															type='button'
															onClick={() => removeFromCart(item.id)}
															aria-label={`Remove ${item.name}`}
															className='p-1 text-deep-tidal-teal-500 transition hover:text-red-600'>
															<Trash2 className='h-4 w-4' />
														</button>
													</div>
													<p className='mt-2 text-deep-tidal-teal-800'>C${itemPrice.toFixed(2)}</p>
													<div className='mt-3 inline-flex items-center overflow-hidden rounded-lg border border-deep-tidal-teal/15 bg-white'>
														<button
															type='button'
															onClick={() => updateQuantity(item.id, item.quantity - 1, item.stock)}
															className='p-2 hover:bg-deep-tidal-teal/5'
															aria-label={`Decrease ${item.name} quantity`}>
															<Minus className='h-3.5 w-3.5' />
														</button>
														<span className='min-w-9 text-center text-sm font-bold'>{item.quantity}</span>
														<button
															type='button'
															onClick={() => updateQuantity(item.id, item.quantity + 1, item.stock)}
															disabled={item.stock > 0 && item.quantity >= item.stock}
															className='p-2 hover:bg-deep-tidal-teal/5 disabled:cursor-not-allowed disabled:opacity-35'
															aria-label={`Increase ${item.name} quantity`}>
															<Plus className='h-3.5 w-3.5' />
														</button>
													</div>
												</div>
											</div>
										);
									})}
								</div>
								<div className='border-t border-deep-tidal-teal/10 bg-white px-6 py-6 sm:px-8'>
									<div className='mb-5 flex items-center justify-end gap-5'>
										<span className='text-deep-tidal-teal-600'>Subtotal</span>
										<span className='text-xl font-semibold leading-none text-deep-tidal-teal-900'>C${getTotal().toFixed(2)}</span>
									</div>
									<Link
										href='/cart'
										onClick={closeCartDrawer}
										className='flex min-h-14 w-full items-center justify-center rounded-lg bg-deep-tidal-teal px-5 font-semibold uppercase tracking-wide text-white transition hover:bg-deep-tidal-teal-600'>
										View cart
									</Link>
									<button
										type='button'
										onClick={closeCartDrawer}
										className='mt-3 min-h-12 w-full rounded-lg border border-deep-tidal-teal/25 font-semibold text-deep-tidal-teal-800 transition hover:bg-deep-tidal-teal/5 uppercase'>
										Keep shopping
									</button>
									<p className='mt-4 text-center text-xs text-deep-tidal-teal-500'>Shipping and discounts are calculated at checkout.</p>
								</div>
							</>
						)}
					</motion.aside>
				</div>
			)}
		</AnimatePresence>
	);
}
