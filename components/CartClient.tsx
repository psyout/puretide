'use client';

import { useState, useMemo } from 'react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';
import { CreditCard, Lock, AlertCircle } from 'lucide-react';
import { ENABLE_CREDIT_CARD } from '@/lib/constants';
import CrossSellSection from './CrossSellSection';
import FreeShippingProgress from './FreeShippingProgress';
import CartItemDetails from './CartItemDetails';
import type { Product } from '@/types/product';

type CartClientProps = {
	products: Product[];
	stockUnavailable: boolean;
};

export default function CartClient({ products, stockUnavailable }: CartClientProps) {
	const { cartItems, removeFromCart, updateQuantity, getTotal, clearCart, getItemPrice, paymentMethod, setPaymentMethod } = useCart();
	const router = useRouter();
	const [showClearConfirm, setShowClearConfirm] = useState(false);
	const total = getTotal();

	// Create a map of product stock for quick lookup
	const productStockMap = useMemo(() => {
		const map = new Map<string, number>();
		products.forEach((product) => {
			map.set(product.id, Number(product.stock) || 0);
			if (product.slug) {
				map.set(product.slug, Number(product.stock) || 0);
			}
		});
		return map;
	}, [products]);

	// Check if any cart item has invalid quantity (exceeds available stock)
	const hasCartInvalidQuantity = cartItems.some((item) => {
		const availableStock = productStockMap.get(item.id) || productStockMap.get(item.slug) || 0;
		return item.quantity > availableStock;
	});

	// Credit card payment limit
	const CREDIT_CARD_LIMIT = 500;
	const creditCardChargeTotal = total * 1.05;
	const isCreditCardDisabled = creditCardChargeTotal > CREDIT_CARD_LIMIT;

	if (cartItems.length === 0) {
		return (
			<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
				<div className='max-w-7xl mx-auto px-6 pt-32 pb-24'>
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
			<div className='max-w-7xl mx-auto px-6 pt-32 pb-24'>
				<Link
					href='/'
					className='text-deep-tidal-teal hover:text-eucalyptus mb-8 inline-block'>
					← Back to Products
				</Link>
				<h1 className='text-3xl font-bold mb-6 text-deep-tidal-teal-800'>
					Your cart, <span className='italic font-thin'>reviewed</span>
				</h1>

				<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
					<div className='lg:col-span-2'>
						{/* Free Shipping Progress Bar */}
						<FreeShippingProgress subtotal={total} />

						<div className='bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 shadow-md'>
							{cartItems.map((item, index) => {
								const availableStock = productStockMap.get(item.id) || productStockMap.get(item.slug) || item.stock || 0;
								const isOutOfStock = availableStock <= 0;
								const isLowStock = availableStock > 0 && availableStock <= 3;
								const isAtStockLimit = item.quantity >= availableStock;
								const hasInvalidQuantity = item.quantity > availableStock;
								const isDiscounted = getItemPrice(item) < item.price;
								const savings = item.price - getItemPrice(item);

								return (
									<div
										key={item.id}
										className={`flex flex-col gap-3 md:gap-4 ${index < cartItems.length - 1 ? 'pb-4 md:pb-6 mb-4 md:mb-6 border-b border-deep-tidal-teal/10' : ''}`}>
										{/* Mobile: Product Overview (Image + Info side by side) */}
										<div className='md:hidden flex gap-3 mb-2 items-start'>
											{/* Product Image */}
											<Link
												href={`/product/${item.slug || item.id}`}
												className='flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center rounded-lg bg-deep-tidal-teal/5 hover:opacity-90 transition-opacity'
												aria-label={`View ${item.name} details`}>
												{hasProductImage(item.image) ? (
													<Image
														src={item.image}
														alt={item.name}
														width={96}
														height={96}
														unoptimized={item.image.startsWith('http')}
														className='max-h-16 max-w-16 sm:max-h-20 sm:max-w-20 w-auto h-auto object-contain'
														priority
													/>
												) : (
													<ProductImagePlaceholder className='max-h-16 max-w-16 sm:max-h-20 sm:max-w-20' />
												)}
											</Link>

											{/* Product Info */}
											<div className='flex-1 min-w-0 flex flex-col'>
												{/* Product Name */}
												<h3 className='text-sm sm:text-base font-bold text-deep-tidal-teal-800 mb-0.5 line-clamp-2 leading-tight'>{item.name}</h3>
												{item.subtitle && <p className='text-xs text-deep-tidal-teal-600 mb-1.5'>{item.subtitle}</p>}

												{/* Stock Status */}
												{stockUnavailable ? (
													<p className='text-xs text-deep-tidal-teal-500 mb-1.5'>Stock unavailable</p>
												) : isOutOfStock ? (
													<div className='flex items-center gap-1.5 text-xs text-red-600 font-medium mb-1.5'>
														<span className='w-1.5 h-1.5 rounded-full bg-red-500' />
														<span>Out of Stock</span>
													</div>
												) : isLowStock ? (
													<div className='flex items-center gap-1.5 text-xs text-yellow-600 font-medium mb-1.5'>
														<span className='w-1.5 h-1.5 rounded-full bg-yellow-500' />
														<span>Low Stock</span>
													</div>
												) : (
													<div className='flex items-center gap-1.5 text-xs text-green-600 font-medium mb-1.5'>
														<span className='w-1.5 h-1.5 rounded-full bg-green-500' />
														<span>In Stock</span>
													</div>
												)}

												{/* Pricing */}
												<div className='flex items-baseline gap-2 mb-1'>
													<p className='text-base sm:text-lg font-bold text-deep-tidal-teal'>${getItemPrice(item).toFixed(2)}</p>
													{isDiscounted && <p className='text-xs text-deep-tidal-teal-600 line-through opacity-60'>${item.price.toFixed(2)}</p>}
												</div>
												{isDiscounted && (
													<span className='inline-block w-fit text-xs font-medium bg-eucalyptus/50 text-deep-tidal-teal-600 px-2 py-0.5 rounded'>
														You save ${savings.toFixed(2)}
													</span>
												)}
											</div>
										</div>

										{/* Mobile: Quantity and Remove Row */}
										<div className='md:hidden flex items-center justify-start gap-3 mb-2'>
											<div className='inline-flex items-center border border-deep-tidal-teal/20 rounded-lg overflow-hidden bg-white'>
												<button
													onClick={item.quantity === 1 ? () => removeFromCart(item.id) : () => updateQuantity(item.id, item.quantity - 1, availableStock)}
													className='p-1.5 text-deep-tidal-teal-800 hover:bg-deep-tidal-teal/10 transition-colors'
													aria-label={item.quantity === 1 ? 'Remove from cart' : 'Decrease quantity'}>
													<span className='w-4 h-4 flex items-center justify-center text-base font-medium'>−</span>
												</button>
												<span className='w-12 px-2 py-1 text-center text-deep-tidal-teal-800 border-x border-deep-tidal-teal/10 font-medium text-sm'>
													{item.quantity}
												</span>
												<button
													onClick={() => updateQuantity(item.id, item.quantity + 1, availableStock)}
													className={`p-1.5 text-deep-tidal-teal-800 hover:bg-deep-tidal-teal/10 transition-colors ${isAtStockLimit || isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}
													aria-label='Increase quantity'
													disabled={isAtStockLimit || isOutOfStock}>
													<span className='w-4 h-4 flex items-center justify-center text-base font-medium'>+</span>
												</button>
											</div>
											<button
												onClick={() => removeFromCart(item.id)}
												className='text-xs text-red-600 hover:text-red-700 font-medium transition-colors whitespace-nowrap'>
												Remove
											</button>
										</div>

										{/* Mobile: Invalid quantity warning */}
										{hasInvalidQuantity && (
											<div className='md:hidden mt-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2'>
												<AlertCircle className='w-3.5 h-3.5 flex-shrink-0' />
												<span>
													Only {availableStock} {availableStock === 1 ? 'unit is' : 'units are'} currently available. Please update your quantity.
												</span>
											</div>
										)}

										{/* Desktop: Main Row - Image | Info | Pricing */}
										<div className='hidden md:flex gap-6 items-start'>
											{/* Desktop: Left Section - Product Image */}
											<Link
												href={`/product/${item.slug || item.id}`}
												className='flex flex-shrink-0 w-36 h-36 items-center justify-center rounded-xl bg-deep-tidal-teal/5 hover:opacity-90 transition-opacity'
												aria-label={`View ${item.name} details`}>
												{hasProductImage(item.image) ? (
													<Image
														src={item.image}
														alt={item.name}
														width={128}
														height={128}
														unoptimized={item.image.startsWith('http')}
														className='max-h-32 max-w-32 w-auto h-auto object-contain'
														priority
													/>
												) : (
													<ProductImagePlaceholder className='max-h-32 max-w-32' />
												)}
											</Link>

											{/* Desktop: Center Section - Product Information */}
											<div className='flex-1 min-w-0 flex flex-col'>
												{/* Product Header: Name + Price */}
												<div className='flex items-start justify-between gap-6'>
													<h3 className='text-xl font-bold text-deep-tidal-teal-800 mb-2'>{item.name}</h3>
													<div className='flex-shrink-0 flex flex-col items-end justify-start w-28'>
														<p className='text-xl font-bold text-deep-tidal-teal mb-1'>${getItemPrice(item).toFixed(2)}</p>
														{isDiscounted && (
															<>
																<p className='text-sm text-deep-tidal-teal-600 line-through opacity-60 mb-1'>${item.price.toFixed(2)}</p>
																<span className='inline-block text-xs font-medium bg-eucalyptus/50 text-deep-tidal-teal-600 px-2 py-1 rounded'>
																	You save ${savings.toFixed(2)}
																</span>
															</>
														)}
													</div>
												</div>
												{item.subtitle && <p className='text-sm text-deep-tidal-teal-600 mb-3'>{item.subtitle}</p>}

												{/* Stock Status */}
												{stockUnavailable ? (
													<p className='text-sm text-deep-tidal-teal-500 mb-3'>Stock unavailable</p>
												) : isOutOfStock ? (
													<div className='flex items-center gap-2 text-sm text-red-600 font-medium mb-3'>
														<span className='w-2 h-2 rounded-full bg-red-500' />
														<span>Out of Stock</span>
													</div>
												) : isLowStock ? (
													<div className='flex items-center gap-2 text-sm text-yellow-600 font-medium mb-3'>
														<span className='w-2 h-2 rounded-full bg-yellow-500' />
														<span>Low Stock</span>
													</div>
												) : (
													<div className='flex items-center gap-2 text-sm text-green-600 font-medium mb-3'>
														<span className='w-2 h-2 rounded-full bg-green-500' />
														<span>In Stock</span>
													</div>
												)}

												{/* Quantity Controls on single row */}
												<div className='flex items-center gap-2 mb-3'>
													<div className='inline-flex items-center border border-deep-tidal-teal/20 rounded-lg overflow-hidden bg-white'>
														<button
															onClick={
																item.quantity === 1 ? () => removeFromCart(item.id) : () => updateQuantity(item.id, item.quantity - 1, availableStock)
															}
															className='p-1.5 text-deep-tidal-teal-800 hover:bg-deep-tidal-teal/10 transition-colors'
															aria-label={item.quantity === 1 ? 'Remove from cart' : 'Decrease quantity'}>
															<span className='w-4 h-4 flex items-center justify-center text-base font-medium'>−</span>
														</button>
														<span className='w-12 px-2 py-1 text-center text-deep-tidal-teal-800 border-x border-deep-tidal-teal/10 font-medium text-sm'>
															{item.quantity}
														</span>
														<button
															onClick={() => updateQuantity(item.id, item.quantity + 1, availableStock)}
															className={`p-1.5 text-deep-tidal-teal-800 hover:bg-deep-tidal-teal/10 transition-colors ${isAtStockLimit || isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}
															aria-label='Increase quantity'
															disabled={isAtStockLimit || isOutOfStock}>
															<span className='w-4 h-4 flex items-center justify-center text-base font-medium'>+</span>
														</button>
													</div>
													<button
														onClick={() => removeFromCart(item.id)}
														className='text-xs text-red-600 hover:text-red-700 font-medium transition-colors whitespace-nowrap'>
														Remove
													</button>
												</div>

												{/* Product Details: Desktop/Tablet only, collapsed by default */}
												<div className='border-t border-deep-tidal-teal/10 pt-3 hidden'>
													<CartItemDetails
														description={item.description}
														details={item.details}
													/>
												</div>

												{/* Invalid quantity warning */}
												{hasInvalidQuantity && (
													<div className='mt-2 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2'>
														<AlertCircle className='w-4 h-4 flex-shrink-0' />
														<span>
															Only {availableStock} {availableStock === 1 ? 'unit is' : 'units are'} currently available. Please update your quantity.
														</span>
													</div>
												)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>

					<div className='lg:col-span-1'>
						<div className='bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 sticky top-24 shadow-md'>
							<h2 className='text-xl font-bold mb-4 text-deep-tidal-teal-800'>Order Summary</h2>
							<div className='space-y-2 mb-2'>
								{cartItems.map((item) => (
									<div
										key={item.id}
										className='flex justify-between text-md'>
										<span className='text-deep-tidal-teal-700 text-[0.9rem]'>
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
									<span className='flex items-center gap-2 text-[0.9rem]'>
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
								{/* Credit Card - Hidden for now - Add Flex, remove Hidden */}
								<label className={`flex items-center justify-between gap-2 ${isCreditCardDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
									<span className='flex items-center gap-2'>
										<input
											type='radio'
											name='cart-payment'
											checked={paymentMethod === 'creditcard'}
											onChange={() => setPaymentMethod('creditcard')}
											disabled={isCreditCardDisabled}
											className={`rounded-full border-deep-tidal-teal/30 text-deep-tidal-teal ${isCreditCardDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
										/>
										<span className='text-deep-tidal-teal-800 text-[0.9rem]'>Credit Card</span>
									</span>
									<span className='text-sm text-deep-tidal-teal-500'>+5% fee</span>
								</label>
							</div>
							{paymentMethod === 'creditcard' && isCreditCardDisabled && (
								<div className='bg-red-50 border border-red-200 rounded-lg p-3 mb-2'>
									<p className='text-sm text-red-700 leading-relaxed'>
										Credit card payments are limited to $500 per transaction. Please select another payment method or split your order.
									</p>
								</div>
							)}
							{paymentMethod === 'creditcard' && (
								<div className='flex justify-between text-sm text-deep-tidal-teal-600 mb-2'>
									<span>Est. card fee (5%)</span>
									<span>${(total * 0.05).toFixed(2)}</span>
								</div>
							)}
							<div className='border-b border-deep-tidal-teal/10 pb-3 mb-3 space-y-2'>
								<div className='flex justify-between text-lg font-bold'>
									<span className='text-deep-tidal-teal-800'>{paymentMethod === 'creditcard' ? 'Est. total' : 'Total'}</span>
									<span className='text-deep-tidal-teal'>${(paymentMethod === 'creditcard' ? total * 1.05 : total).toFixed(2)}</span>
								</div>
								{paymentMethod === 'creditcard' && <p className='text-xs text-deep-tidal-teal-600 mt-2'>Shipping and final total confirmed at checkout.</p>}
							</div>
							{/* Cross-sell section */}
							<CrossSellSection />
							<button
								onClick={() => {
									if (paymentMethod === 'creditcard' && creditCardChargeTotal > 500) {
										alert('Credit card payments are limited to $500 per transaction. Please select another payment method or split your order.');
										return;
									}
									if (hasCartInvalidQuantity) {
										alert('Please update your quantities to match available stock before proceeding to checkout.');
										return;
									}
									router.push('/checkout');
								}}
								className='w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-white font-semibold py-3 px-4 rounded transition-colors mb-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
								disabled={hasCartInvalidQuantity}>
								<span className='flex items-center gap-2 uppercase text-sm'>
									<Lock size={18} /> Secure Checkout
								</span>
							</button>
						</div>
					</div>
				</div>
			</div>
			{paymentMethod === 'creditcard' && !ENABLE_CREDIT_CARD && (
				<div className='fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center'>
					<div className='w-full max-w-md rounded-xl bg-mineral-white shadow-2xl ui-border p-6'>
						<h3 className='text-xl font-bold text-deep-tidal-teal-800 mb-2'>Credit Card Notice</h3>
						<p className='text-sm text-deep-tidal-teal-700 leading-relaxed'>
							Credit card payments are temporarily unavailable. Please use e-transfer as an alternative payment method at checkout. Secure card processing will be available soon.
						</p>
						<div className='mt-5 flex justify-end'>
							<button
								type='button'
								onClick={() => setPaymentMethod('etransfer')}
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
