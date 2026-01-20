'use client';

import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function CartPage() {
	const { cartItems, removeFromCart, updateQuantity, getTotal, clearCart } = useCart();
	const router = useRouter();
	const total = getTotal();

	if (cartItems.length === 0) {
		return (
			<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
				<div className='container mx-auto px-4 py-12'>
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
			<div className='container mx-auto px-4 py-12'>
				<Link
					href='/'
					className='text-orange-500 hover:text-orange-400 mb-8 inline-block'>
					← Back to Products
				</Link>
				<h1 className='text-4xl font-bold mb-8 text-deep-tidal-teal-800'>Shopping Cart</h1>

				<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
					<div className='lg:col-span-2 space-y-4'>
						{cartItems.map((item) => (
							<div
								key={item.id}
								className='bg-eucalyptus-100/60 backdrop-blur-sm rounded-lg ui-border p-6 flex items-center gap-6 shadow-lg'>
								<div className='h-28 w-28 flex items-center justify-center rounded-lg bg-white shadow-sm'>
									{item.image.startsWith('/') || item.image.startsWith('http') ? (
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
										<span className='text-5xl'>{item.image}</span>
									)}
								</div>
								<div className='flex-1'>
									<div className='flex items-baseline justify-between gap-3 flex-col lg:items-start lg:gap-1'>
										<h3 className='text-xl font-semibold text-deep-tidal-teal-800'>{item.name}</h3>
										<p className='text-xl text-deep-tidal-teal font-bold'>${item.price.toFixed(2)}</p>
									</div>
									<p className='text-md text-deep-tidal-teal-700 mt-2'>{item.description}</p>
									<div className='mt-3 flex w-full items-center justify-between gap-4 lg:hidden'>
										<div className='flex items-center gap-2 text-deep-tidal-teal-800'>
											<button
												onClick={() => updateQuantity(item.id, item.quantity - 1)}
												className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white w-8 h-8 rounded'>
												-
											</button>
											<span className='w-8 text-center text-deep-tidal-teal-800'>{item.quantity}</span>
											<button
												onClick={() => updateQuantity(item.id, item.quantity + 1)}
												className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white w-8 h-8 rounded'>
												+
											</button>
										</div>
										<button
											onClick={() => removeFromCart(item.id)}
											className='text-red-400 hover:text-red-300'>
											Remove
										</button>
									</div>
								</div>
								<div className='hidden lg:flex items-center gap-4'>
									<div className='flex items-center gap-2 text-deep-tidal-teal-800'>
										<button
											onClick={() => updateQuantity(item.id, item.quantity - 1)}
											className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white w-8 h-8 rounded'>
											-
										</button>
										<span className='w-8 text-center text-deep-tidal-teal-800'>{item.quantity}</span>
										<button
											onClick={() => updateQuantity(item.id, item.quantity + 1)}
											className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white w-8 h-8 rounded'>
											+
										</button>
									</div>
									<button
										onClick={() => removeFromCart(item.id)}
										className='text-red-400 hover:text-red-300 ml-4'>
										Remove
									</button>
								</div>
							</div>
						))}
					</div>

					<div className='lg:col-span-1'>
						<div className='bg-eucalyptus-100/60 backdrop-blur-sm rounded-lg ui-border p-6 sticky top-24 shadow-lg'>
							<h2 className='text-2xl font-bold mb-4 text-deep-tidal-teal-800'>Order Summary</h2>
							<div className='space-y-2 mb-6'>
								{cartItems.map((item) => (
									<div
										key={item.id}
										className='flex justify-between text-md'>
										<span className='text-deep-tidal-teal-700'>
											{item.name} × {item.quantity}
										</span>
										<span className='text-deep-tidal-teal-800 font-semibold'>${(item.price * item.quantity).toFixed(2)}</span>
									</div>
								))}
							</div>
							<div className='ui-border-t pt-4 mb-6'>
								<div className='flex justify-between text-xl font-bold'>
									<span className='text-deep-tidal-teal-800'>Total</span>
									<span className='text-deep-tidal-teal'>${total.toFixed(2)}</span>
								</div>
							</div>
							<button
								onClick={() => router.push('/checkout')}
								className='w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-white font-semibold py-3 px-4 rounded transition-colors mb-4'>
								Proceed to Checkout
							</button>
							<button
								onClick={clearCart}
								className='w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-white font-semibold py-2 px-4 rounded transition-colors'>
								Clear Cart
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
