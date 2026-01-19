'use client';

import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CheckoutPage() {
	const { cartItems, getTotal, clearCart } = useCart();
	const router = useRouter();
	const [formData, setFormData] = useState({
		firstName: '',
		lastName: '',
		country: 'Canada',
		email: '',
		phone: '',
		address: '',
		addressLine2: '',
		city: '',
		province: 'British Columbia',
		zipCode: '',
		orderNotes: '',
	});
	const [isProcessing, setIsProcessing] = useState(false);
	const [hasSubmitted, setHasSubmitted] = useState(false);
	const [shipToDifferentAddress, setShipToDifferentAddress] = useState(false);
	const [shippingMethod, setShippingMethod] = useState<'regular' | 'express'>('regular');
	const [shippingAddress, setShippingAddress] = useState({
		address: '',
		addressLine2: '',
		city: '',
		province: 'British Columbia',
		zipCode: '',
	});

	const subtotal = getTotal();
	const shippingCost = shippingMethod === 'express' ? 29.99 : 19.99;
	const total = Number((subtotal + shippingCost).toFixed(2));

	useEffect(() => {
		if (cartItems.length === 0 && !hasSubmitted) {
			router.push('/cart');
		}
	}, [cartItems.length, hasSubmitted, router]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsProcessing(true);
		setHasSubmitted(true);

		try {
			const response = await fetch('/api/orders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					customer: formData,
					shipToDifferentAddress,
					shippingAddress: shipToDifferentAddress ? shippingAddress : undefined,
					shippingMethod,
					subtotal,
					shippingCost,
					total,
					cartItems,
				}),
			});

			if (!response.ok) {
				throw new Error('Failed to store order');
			}
		} catch (error) {
			console.error('Checkout error', error);
			alert('We could not place your order. Please try again.');
			setIsProcessing(false);
			setHasSubmitted(false);
			return;
		}

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
						<div className='bg-eucalyptus-100/60 backdrop-blur-sm rounded-lg border border-black/10 p-6 mb-6 shadow-lg'>
							<h2 className='text-2xl font-bold mb-6 text-deep-tidal-teal-800'>Billing details</h2>
							<form
								onSubmit={handleSubmit}
								className='space-y-4'>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>First name *</label>
									<input
										type='text'
										value={formData.firstName}
										onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
										className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										required
									/>
								</div>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Last name *</label>
									<input
										type='text'
										value={formData.lastName}
										onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
										className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										required
									/>
								</div>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Country / Region *</label>
									<select
										value={formData.country}
										onChange={(e) => setFormData({ ...formData, country: e.target.value })}
										className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										required>
										<option value='Canada'>Canada</option>
									</select>
								</div>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Street address *</label>
									<input
										type='text'
										value={formData.address}
										onChange={(e) => setFormData({ ...formData, address: e.target.value })}
										placeholder='House number and street name'
										className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										required
									/>
								</div>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Apartment, suite, unit, etc. (optional)</label>
									<input
										type='text'
										value={formData.addressLine2}
										onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
										placeholder='Apartment, suite, unit, etc. (optional)'
										className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
									/>
								</div>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Town / City *</label>
									<input
										type='text'
										value={formData.city}
										onChange={(e) => setFormData({ ...formData, city: e.target.value })}
										className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										required
									/>
								</div>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Province *</label>
									<select
										value={formData.province}
										onChange={(e) => setFormData({ ...formData, province: e.target.value })}
										className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										required>
										<option value='British Columbia'>British Columbia</option>
										<option value='Alberta'>Alberta</option>
										<option value='Manitoba'>Manitoba</option>
										<option value='New Brunswick'>New Brunswick</option>
										<option value='Newfoundland and Labrador'>Newfoundland and Labrador</option>
										<option value='Nova Scotia'>Nova Scotia</option>
										<option value='Ontario'>Ontario</option>
										<option value='Prince Edward Island'>Prince Edward Island</option>
										<option value='Quebec'>Quebec</option>
										<option value='Saskatchewan'>Saskatchewan</option>
										<option value='Northwest Territories'>Northwest Territories</option>
										<option value='Nunavut'>Nunavut</option>
										<option value='Yukon'>Yukon</option>
									</select>
								</div>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Postal code *</label>
									<input
										type='text'
										value={formData.zipCode}
										onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
										className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										required
									/>
								</div>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Phone (optional)</label>
									<input
										type='tel'
										value={formData.phone}
										onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
										className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
									/>
								</div>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Email address *</label>
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
								
								<div className='flex items-start gap-2 text-sm text-deep-tidal-teal-800'>
									<input
										type='checkbox'
										checked={shipToDifferentAddress}
										onChange={(e) => setShipToDifferentAddress(e.target.checked)}
										className='mt-1'
									/>
									<span>Ship to a different address?</span>
								</div>
								{shipToDifferentAddress && (
									<div className='space-y-4 rounded-lg bg-mineral-white border border-muted-sage-300 p-4'>
										<div>
											<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Street address *</label>
											<input
												type='text'
												value={shippingAddress.address}
												onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })}
												placeholder='House number and street name'
												className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
												required
											/>
										</div>
										<div>
											<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Apartment, suite, unit, etc. (optional)</label>
											<input
												type='text'
												value={shippingAddress.addressLine2}
												onChange={(e) => setShippingAddress({ ...shippingAddress, addressLine2: e.target.value })}
												placeholder='Apartment, suite, unit, etc. (optional)'
												className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
											/>
										</div>
										<div>
											<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Town / City *</label>
											<input
												type='text'
												value={shippingAddress.city}
												onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
												className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
												required
											/>
										</div>
										<div>
											<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Province *</label>
											<select
												value={shippingAddress.province}
												onChange={(e) => setShippingAddress({ ...shippingAddress, province: e.target.value })}
												className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
												required>
												<option value='British Columbia'>British Columbia</option>
												<option value='Alberta'>Alberta</option>
												<option value='Manitoba'>Manitoba</option>
												<option value='New Brunswick'>New Brunswick</option>
												<option value='Newfoundland and Labrador'>Newfoundland and Labrador</option>
												<option value='Nova Scotia'>Nova Scotia</option>
												<option value='Ontario'>Ontario</option>
												<option value='Prince Edward Island'>Prince Edward Island</option>
												<option value='Quebec'>Quebec</option>
												<option value='Saskatchewan'>Saskatchewan</option>
												<option value='Northwest Territories'>Northwest Territories</option>
												<option value='Nunavut'>Nunavut</option>
												<option value='Yukon'>Yukon</option>
											</select>
										</div>
										<div>
											<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Postal code *</label>
											<input
												type='text'
												value={shippingAddress.zipCode}
												onChange={(e) => setShippingAddress({ ...shippingAddress, zipCode: e.target.value })}
												className='w-full bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
												required
											/>
										</div>
									</div>
								)}
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Order notes (optional)</label>
									<textarea
										value={formData.orderNotes}
										onChange={(e) => setFormData({ ...formData, orderNotes: e.target.value })}
										placeholder='Notes about your order, e.g. special notes for delivery.'
										className='w-full min-h-[120px] bg-mineral-white border border-muted-sage-400 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
									/>
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
							<h2 className='text-2xl font-bold mb-4 text-deep-tidal-teal-800'>Your order</h2>
							<div className='space-y-2 mb-6'>
								{cartItems.map((item) => (
									<div
										key={item.id}
										className='flex justify-between text-md'>
										<span className='text-deep-tidal-teal-700'>
											{item.name}
											<br />
											<span className='text-xs text-deep-tidal-teal-600'>Quantity: {item.quantity}</span>
										</span>
										<span className='text-deep-tidal-teal-800 font-semibold'>${(item.price * item.quantity).toFixed(2)}</span>
									</div>
								))}
							</div>
							<div className='border-t border-muted-sage-400 pt-4 space-y-2 text-md'>
								<div className='flex justify-between'>
									<span className='text-deep-tidal-teal-700'>Subtotal</span>
									<span className='text-deep-tidal-teal-800 font-semibold'>${subtotal.toFixed(2)}</span>
								</div>
								<div className='space-y-2'>
									<div className='text-deep-tidal-teal-700'>Shipping</div>
									<label className='flex items-center justify-between gap-2 text-deep-tidal-teal-800'>
										<span className='flex items-center gap-2'>
											<input
												type='radio'
												name='shipping'
												checked={shippingMethod === 'regular'}
												onChange={() => setShippingMethod('regular')}
											/>
											Regular Shipping
										</span>
										<span>${19.99.toFixed(2)}</span>
									</label>
									<label className='flex items-center justify-between gap-2 text-deep-tidal-teal-800'>
										<span className='flex items-center gap-2'>
											<input
												type='radio'
												name='shipping'
												checked={shippingMethod === 'express'}
												onChange={() => setShippingMethod('express')}
											/>
											Express Shipping
										</span>
										<span>${29.99.toFixed(2)}</span>
									</label>
								</div>
								<div className='border-t border-muted-sage-400 pt-3 flex justify-between text-xl font-bold'>
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
