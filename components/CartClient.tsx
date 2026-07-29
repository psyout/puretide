'use client';

import { useMemo } from 'react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';
import { Lock, AlertCircle, PackageCheck, ShieldCheck } from 'lucide-react';
import CrossSellSection from './CrossSellSection';
import FreeShippingProgress from './FreeShippingProgress';
import CartItemDetails from './CartItemDetails';
import type { Product } from '@/types/product';
import { buildCartStockMap, hasInvalidCartQuantity, resolveCartItemStock } from '@/lib/cartStock';

type CartClientProps = {
	products: Product[];
	stockUnavailable: boolean;
};

export default function CartClient({ products, stockUnavailable }: CartClientProps) {
	const { cartItems, removeFromCart, updateQuantity, getTotal, getItemPrice } = useCart();
	const router = useRouter();
	const total = getTotal();
	const totalSavings = cartItems.reduce((sum, item) => sum + Math.max(0, item.price - getItemPrice(item)) * item.quantity, 0);

	// Create a map of product stock for quick lookup
	const productStockMap = useMemo(() => buildCartStockMap(products), [products]);

	// Check if any cart item has invalid quantity (exceeds available stock)
	const hasCartInvalidQuantity = hasInvalidCartQuantity(productStockMap, cartItems, stockUnavailable);

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
				<h1 className='text-3xl font-bold mb-6 text-deep-tidal-teal-800'>Your Cart</h1>

				<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
					<div className='lg:col-span-2'>
						{/* Free Shipping Progress Bar */}
						<FreeShippingProgress subtotal={total} />

						<div className='bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 shadow-md'>
							{cartItems.map((item, index) => {
								const liveStock = resolveCartItemStock(productStockMap, item);
								const storedStock = Number(item.stock) || 0;
								const availableStock = stockUnavailable ? storedStock : (liveStock ?? storedStock);
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
												<h3 className='text-md sm:text-base font-bold text-deep-tidal-teal-800 mb-0.5 line-clamp-2 leading-tight'>{item.name}</h3>
												{item.subtitle && <p className='text-[0.85rem] text-deep-tidal-teal-600 mb-1.5'>{item.subtitle}</p>}

												{/* Stock Status */}
												{isOutOfStock ? (
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
										<div className='hidden md:grid md:grid-cols-[9rem_minmax(0,1fr)_9rem] gap-6 items-start'>
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
												<h3 className='text-xl font-bold text-deep-tidal-teal-800 mb-2'>{item.name}</h3>
												{item.subtitle && <p className='text-sm text-deep-tidal-teal-600 mb-3'>{item.subtitle}</p>}

												{/* Stock Status */}
												{isOutOfStock ? (
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

											{/* Price is its own grid column so discount details never push product information down. */}
											<div className='flex min-w-0 flex-col items-end justify-start text-right'>
												<p className='text-xl font-bold text-deep-tidal-teal mb-1'>${getItemPrice(item).toFixed(2)}</p>
												{isDiscounted && (
													<>
														<p className='text-sm text-deep-tidal-teal-600 line-through opacity-60 mb-1'>${item.price.toFixed(2)}</p>
														<span className='whitespace-nowrap text-xs font-medium bg-eucalyptus/50 text-deep-tidal-teal-600 px-2 py-1 rounded'>
															You save ${savings.toFixed(2)}
														</span>
													</>
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
							<div
								className='space-y-2 mb-3'
								aria-live='polite'>
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
							<div className='border-t border-deep-tidal-teal/10 pt-3 pb-3 mb-1 space-y-2'>
								{totalSavings > 0 && (
									<div className='flex justify-between text-sm font-semibold text-emerald-700'>
										<span>You save</span>
										<span>−${totalSavings.toFixed(2)}</span>
									</div>
								)}
								<div className='flex justify-between text-lg font-bold'>
									<span className='text-deep-tidal-teal-800'>Subtotal</span>
									<span className='text-deep-tidal-teal'>${total.toFixed(2)}</span>
								</div>
								<p className='text-xs text-deep-tidal-teal-600'>Shipping and payment fees, if applicable, are confirmed at checkout.</p>
							</div>
							<button
								onClick={() => {
									if (hasCartInvalidQuantity) {
										alert('Please update your quantities to match available stock before proceeding to checkout.');
										return;
									}
									router.push('/checkout');
								}}
								className='w-full min-h-14 bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
								disabled={hasCartInvalidQuantity}>
								<span className='flex items-center gap-2 text-base'>
									<Lock size={18} /> Continue to Checkout
								</span>
							</button>
							<div className='mt-4 grid grid-cols-2 gap-2 text-xs text-deep-tidal-teal-700'>
								<span className='flex items-center gap-1.5'>
									<ShieldCheck className='h-4 w-4 shrink-0' />
									Secure payment
								</span>
								<span className='flex items-center justify-end gap-1.5 text-right'>
									<PackageCheck className='h-4 w-4 shrink-0' />
									Discreet packaging
								</span>
							</div>
							<div className='mt-5 border-t border-deep-tidal-teal/10 pt-5'>
								<CrossSellSection />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
