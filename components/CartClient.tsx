'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';
import { Trash2, CreditCard } from 'lucide-react';

export default function CartClient() {
	const { cartItems, removeFromCart, updateQuantity, getTotal, clearCart, getItemPrice, paymentMethod, setPaymentMethod } = useCart();
	const router = useRouter();
	const [showClearConfirm, setShowClearConfirm] = useState(false);
	const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
	const total = getTotal();

	if (cartItems.length === 0) {
		return (
			<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
				<div className='max-w-7xl mx-auto px-6 py-24'>
					<Link
						href='/'
						className='text-deep-tidal-teal hover:text-eucalyptus mb-8 inline-block'>
						← Back to Products
					</Link>
					<div className='text-center py-20'>
						<div className='mb-4 flex justify-center'>
							<svg
								className='w-16 h-16 text-deep-tidal-teal'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={1.5}
									d='M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z'
								/>
							</svg>
						</div>
						<h1 className='text-3xl font-bold mb-4 text-deep-tidal-teal-800'>Your cart is empty</h1>
						<p className='text-deep-tidal-teal-700 mb-8'>Start shopping to add items to your cart</p>
						<Link
							href='/'
							className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors inline-block'>
							Browse Products
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<div className='max-w-7xl mx-auto px-6 py-24'>
				<Link
					href='/'
					className='text-deep-tidal-teal hover:text-eucalyptus mb-8 inline-block'>
					← Back to Products
				</Link>
				<h1 className='text-4xl font-bold mb-8 text-deep-tidal-teal-800'>My Cart</h1>

				<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
					<div className='lg:col-span-2'>
						<div className='bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 shadow-md'>
							{cartItems.map((item, index) => (
								<div
									key={item.id}
									className={`flex items-center gap-6 ${index < cartItems.length - 1 ? 'pb-6 mb-6 border-b border-deep-tidal-teal/10' : ''}`}>
									<Link
										href={`/product/${item.slug || item.id}`}
										className='h-28 w-28 flex-shrink-0 flex items-center justify-center rounded-lg hover:opacity-90 transition-opacity'
										aria-label={`View ${item.name} details`}>
										{hasProductImage(item.image) ? (
											<Image
												src={item.image}
												alt={item.name}
												width={96}
												height={96}
												style={{ width: 'auto', height: 'auto' }}
												unoptimized={item.image.startsWith('http')}
												className='max-h-24 max-w-24 w-auto h-auto object-contain'
												priority
											/>
										) : (
											<ProductImagePlaceholder className='max-h-24 max-w-24' />
										)}
									</Link>
									<div className='flex-1'>
										<div className='flex items-baseline justify-between gap-3 flex-col lg:items-start lg:gap-1'>
											<h3 className='text-xl font-semibold text-deep-tidal-teal-800'>{item.name}</h3>
											<div className='flex items-center gap-2'>
												<p className='text-2xl text-deep-tidal-teal font-bold'>${getItemPrice(item).toFixed(2)}</p>
												{getItemPrice(item) < item.price && (
													<span className='text-lg text-deep-tidal-teal-600 line-through opacity-60'>${item.price.toFixed(2)}</span>
												)}
											</div>
										</div>
										<p className='mt-2 text-[clamp(0.84rem,2.9vw,0.9rem)] leading-[clamp(1.28rem,4.2vw,1.45rem)] text-deep-tidal-teal-700 text-wrap break-words hyphens-auto'>
											{item.description}
										</p>
										<div className='mt-3 flex w-full items-center justify-flex-start flex-wrap gap-4 lg:hidden'>
											<div className='inline-flex items-center border border-deep-tidal-teal/20 rounded-lg overflow-hidden bg-white'>
												<button
													onClick={item.quantity === 1 ? () => removeFromCart(item.id) : () => updateQuantity(item.id, item.quantity - 1, item.stock)}
													className='p-2 text-deep-tidal-teal-800 hover:bg-deep-tidal-teal/10 transition-colors'
													aria-label={item.quantity === 1 ? 'Remove from cart' : 'Decrease quantity'}>
													{item.quantity === 1 ? (
														<Trash2 className='w-5 h-5 text-red-500' />
													) : (
														<span className='w-5 h-5 flex items-center justify-center text-lg font-medium'>−</span>
													)}
												</button>
												<span className='min-w-[2rem] px-2 py-1.5 text-center text-deep-tidal-teal-800 border-x border-deep-tidal-teal/10'>{item.quantity}</span>
												<button
													onClick={() => updateQuantity(item.id, item.quantity + 1, item.stock)}
													className='p-2 text-deep-tidal-teal-800 hover:bg-deep-tidal-teal/10 transition-colors'
													aria-label='Increase quantity'>
													<span className='w-5 h-5 flex items-center justify-center text-lg font-medium'>+</span>
												</button>
											</div>
										</div>
									</div>
									<div className='hidden lg:flex items-center'>
										<div className='inline-flex items-center border border-deep-tidal-teal/20 rounded-lg overflow-hidden bg-white'>
											<button
												onClick={item.quantity === 1 ? () => removeFromCart(item.id) : () => updateQuantity(item.id, item.quantity - 1, item.stock)}
												className='p-2 text-deep-tidal-teal-800 hover:bg-deep-tidal-teal/10 transition-colors'
												aria-label={item.quantity === 1 ? 'Remove from cart' : 'Decrease quantity'}>
												{item.quantity === 1 ? (
													<Trash2 className='w-5 h-5 text-red-500' />
												) : (
													<span className='w-5 h-5 flex items-center justify-center text-lg font-medium'>−</span>
												)}
											</button>
											<span className='min-w-[2rem] px-2 py-1.5 text-center text-deep-tidal-teal-800 border-x border-deep-tidal-teal/10'>{item.quantity}</span>
											<button
												onClick={() => updateQuantity(item.id, item.quantity + 1, item.stock)}
												className='p-2 text-deep-tidal-teal-800 hover:bg-deep-tidal-teal/10 transition-colors'
												aria-label='Increase quantity'>
												<span className='w-5 h-5 flex items-center justify-center text-lg font-medium'>+</span>
											</button>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>

					<div className='lg:col-span-1'>
						<div className='bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 sticky top-24 shadow-md'>
							<h2 className='text-2xl font-bold mb-4 text-deep-tidal-teal-800'>Order Summary</h2>
							<div className='space-y-2 mb-6'>
								{cartItems.map((item) => (
									<div
										key={item.id}
										className='flex justify-between text-md'>
										<span className='text-deep-tidal-teal-700'>
											{item.name} × {item.quantity}
										</span>
										<span className='text-deep-tidal-teal-800 font-semibold'>${(getItemPrice(item) * item.quantity).toFixed(2)}</span>
									</div>
								))}
							</div>
							{/* Payment Method */}
							<div className='border-t border-deep-tidal-teal/10 pt-3 mb-3 space-y-2'>
								<h3 className='text-sm font-semibold text-deep-tidal-teal-800 flex items-center gap-2'>
									<CreditCard className='w-4 h-4' />
									Payment Method
								</h3>
								<label className='flex items-center justify-between gap-2 text-deep-tidal-teal-800 cursor-pointer'>
									<span className='flex items-center gap-2'>
										<input
											type='radio'
											name='cart-payment'
											checked={paymentMethod === 'etransfer'}
											onChange={() => setPaymentMethod('etransfer')}
											className='rounded-full border-deep-tidal-teal/30 text-deep-tidal-teal'
										/>
										E-Transfer (Interac)
									</span>
									<span className='text-sm text-deep-tidal-teal-500'>No fee</span>
								</label>
								<label className='flex items-center justify-between gap-2 text-deep-tidal-teal-800 cursor-pointer'>
									<span className='flex items-center gap-2'>
										<input
											type='radio'
											name='cart-payment'
											checked={paymentMethod === 'creditcard'}
											onChange={() => {
													setPaymentMethod('etransfer');
												setShowCreditCardAlert(true);
											}}
											className='rounded-full border-deep-tidal-teal/30 text-deep-tidal-teal'
										/>
										Credit Card
									</span>
									<span className='text-sm text-deep-tidal-teal-500'>+5% fee</span>
								</label>
							</div>
							{paymentMethod === 'creditcard' && (
								<div className='flex justify-between text-sm text-deep-tidal-teal-600 mb-2'>
									<span>Est. card fee (5%)</span>
									<span>${(total * 0.05).toFixed(2)}</span>
								</div>
							)}
							<div className='ui-border-t pt-4 mb-6'>
								<div className='flex justify-between text-xl font-bold'>
									<span className='text-deep-tidal-teal-800'>{paymentMethod === 'creditcard' ? 'Est. total' : 'Total'}</span>
									<span className='text-deep-tidal-teal'>${(paymentMethod === 'creditcard' ? total * 1.05 : total).toFixed(2)}</span>
								</div>
								{paymentMethod === 'creditcard' && <p className='text-xs text-deep-tidal-teal-600 mt-2'>Shipping and final total confirmed at checkout.</p>}
							</div>
							<button
								onClick={() => router.push('/checkout')}
								className='w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-white font-semibold py-3 px-4 rounded transition-colors mb-4'>
								Proceed to Checkout
							</button>
							{showClearConfirm ? (
								<div className='flex gap-2'>
									<button
										onClick={() => {
											clearCart();
											setShowClearConfirm(false);
										}}
										className='flex-1 border border-red-500 text-red-600 hover:bg-red-50 font-semibold py-2 px-4 rounded transition-colors'>
										Yes, clear cart
									</button>
									<button
										onClick={() => setShowClearConfirm(false)}
										className='flex-1 border border-deep-tidal-teal/30 text-deep-tidal-teal-800 hover:bg-deep-tidal-teal/10 font-semibold py-2 px-4 rounded transition-colors'>
										Cancel
									</button>
								</div>
							) : (
								<button
									onClick={() => setShowClearConfirm(true)}
									className='w-full border border-deep-tidal-teal/30 text-deep-tidal-teal-800 hover:bg-deep-tidal-teal/10 font-semibold py-2 px-4 rounded transition-colors'>
									Clear Cart
								</button>
							)}
						</div>
					</div>
				</div>
			</div>
			{showCreditCardAlert && (
				<div className='fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center'>
					<div className='w-full max-w-md rounded-xl bg-mineral-white shadow-2xl ui-border p-6'>
						<h3 className='text-xl font-bold text-deep-tidal-teal-800 mb-2'>Credit Card Notice</h3>
						<p className='text-sm text-deep-tidal-teal-700 leading-relaxed'>
							Credit card payments are temporarily unavailable. Please use e-transfer as an alternative payment method at checkout. Secure card processing will be available soon.
						</p>
						<div className='mt-5 flex justify-end'>
							<button
								type='button'
								onClick={() => {
									setPaymentMethod('etransfer');
									setShowCreditCardAlert(false);
								}}
								className='px-4 py-2 rounded bg-deep-tidal-teal text-mineral-white hover:bg-deep-tidal-teal-600 transition-colors font-semibold'>
								Got it
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
