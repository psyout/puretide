'use client';

import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CheckoutPage() {
	const { cartItems, getTotal, clearCart } = useCart();
	const router = useRouter();
	const [formData, setFormData] = useState({
		email: '',
		address: '',
		city: '',
		zipCode: '',
	});
	const [isProcessing, setIsProcessing] = useState(false);
	const [hasSubmitted, setHasSubmitted] = useState(false);

	const total = getTotal();

	useEffect(() => {
		if (cartItems.length === 0 && !hasSubmitted) {
			router.push('/cart');
		}
	}, [cartItems.length, hasSubmitted, router]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsProcessing(true);
		setHasSubmitted(true);

		// Simulate processing (in real app, this would be an API call)
		// Privacy-focused: No data sent to external services
		await new Promise((resolve) => setTimeout(resolve, 2000));

		clearCart();
		router.push('/order-confirmation');
	};

	if (cartItems.length === 0) {
		return null;
	}

	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<div className='container mx-auto px-4 py-12'>
				<Link
					href='/cart'
					className='text-deep-tidal-teal hover:text-eucalyptus mb-8 inline-block'>
					← Back to Cart
				</Link>
				<h1 className='text-4xl font-bold mb-8 text-deep-tidal-teal-800'>Checkout</h1>

				<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
					<div className='lg:col-span-2'>
						<div className='bg-eucalyptus-100/60 backdrop-blur-sm rounded-lg border border-muted-sage-400 p-6 mb-6 shadow-lg'>
							<h2 className='text-2xl font-bold mb-6 text-deep-tidal-teal-800'>Shipping Information</h2>
							<form
								onSubmit={handleSubmit}
								className='space-y-4'>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Email (for order confirmation)</label>
									<input
										type='email'
										value={formData.email}
										onChange={(e) => setFormData({ ...formData, email: e.target.value })}
										className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										required
									/>
									<p className='text-xs text-deep-tidal-teal-600 mt-1 flex items-center gap-1'>
										<svg
											className='w-3 h-3 inline'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={1.5}
												d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
											/>
										</svg>
										Your email is only used for order confirmation. Not shared with third parties.
									</p>
								</div>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Shipping Address</label>
									<input
										type='text'
										value={formData.address}
										onChange={(e) => setFormData({ ...formData, address: e.target.value })}
										className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										required
									/>
								</div>
								<div className='grid grid-cols-2 gap-4'>
									<div>
										<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>City</label>
										<input
											type='text'
											value={formData.city}
											onChange={(e) => setFormData({ ...formData, city: e.target.value })}
											className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
											required
										/>
									</div>
									<div>
										<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>ZIP Code</label>
										<input
											type='text'
											value={formData.zipCode}
											onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
											className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
											required
										/>
									</div>
								</div>
								<div className='bg-eucalyptus-100/60 p-4 rounded border border-muted-sage-400 shadow-md'>
									<div className='flex items-center gap-2 mb-2'>
										<svg
											className='w-5 h-5 text-deep-tidal-teal'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={1.5}
												d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
											/>
										</svg>
										<h3 className='font-semibold text-deep-tidal-teal-800'>Privacy Notice</h3>
									</div>
									<p className='text-sm text-deep-tidal-teal-700'>
										All information is encrypted and stored securely. We do not share your data with third parties. Payments are processed anonymously. Your identity
										remains protected.
									</p>
								</div>
								<div className='bg-mineral-white p-4 rounded border border-muted-sage-400 shadow-md'>
									<h3 className='font-semibold text-deep-tidal-teal-800 mb-2'>Interac e-Transfer</h3>
									<p className='text-sm text-deep-tidal-teal-800'>
										After placing your order, please send an Interac e-Transfer with the instructions provided. You will receive the question and password to complete the
										transfer.
									</p>
								</div>
								<button
									type='submit'
									disabled={isProcessing}
									className='w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 disabled:bg-muted-sage-400 text-mineral-white font-semibold py-3 px-4 rounded transition-colors'>
									{isProcessing ? 'Processing...' : 'Place Order'}
								</button>
							</form>
						</div>
					</div>

					<div className='lg:col-span-1'>
						<div className='bg-eucalyptus-100/60 backdrop-blur-sm rounded-lg border border-muted-sage-400 p-6 sticky top-24 shadow-lg'>
							<h2 className='text-2xl font-bold mb-4 text-deep-tidal-teal-800'>Order Summary</h2>
							<div className='space-y-2 mb-6'>
								{cartItems.map((item) => (
									<div
										key={item.id}
										className='flex justify-between text-sm'>
										<span className='text-deep-tidal-teal-700'>
											{item.name} × {item.quantity}
										</span>
										<span className='text-deep-tidal-teal-800 font-semibold'>${(item.price * item.quantity).toFixed(2)}</span>
									</div>
								))}
							</div>
							<div className='border-t border-muted-sage-400 pt-4'>
								<div className='flex justify-between text-xl font-bold'>
									<span className='text-deep-tidal-teal-800'>Total</span>
									<span className='text-deep-tidal-teal'>${total.toFixed(2)}</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
