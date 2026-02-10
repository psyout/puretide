'use client';

import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CreditCard, Truck, Plus, Minus } from 'lucide-react';
import TermsContent from './TermsContent';
import { SHIPPING_COSTS } from '@/lib/constants';

export default function CheckoutClient() {
	const { cartItems, getTotal, clearCart, getItemPrice, updateQuantity, removeFromCart } = useCart();
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
	const [showPromoInput, setShowPromoInput] = useState(false);
	const [promoCode, setPromoCode] = useState('');
	const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
	const [promoError, setPromoError] = useState<string | null>(null);
	const [isVerifyingPromo, setIsVerifyingPromo] = useState(false);
	const [shipToDifferentAddress, setShipToDifferentAddress] = useState(false);
	const [shippingMethod, setShippingMethod] = useState<'regular' | 'express'>('regular');
	const [paymentMethod, setPaymentMethod] = useState<'etransfer' | 'creditcard'>('etransfer');
	const [agreedToTerms, setAgreedToTerms] = useState(false);
	const [showTermsModal, setShowTermsModal] = useState(false);
	const [shippingAddress, setShippingAddress] = useState({
		address: '',
		addressLine2: '',
		city: '',
		province: 'British Columbia',
		zipCode: '',
	});

	const subtotal = getTotal();
	const shippingCost = shippingMethod === 'express' ? SHIPPING_COSTS.express : SHIPPING_COSTS.regular;
	const discountAmount = Number((subtotal * (appliedDiscount / 100)).toFixed(2));
	const cardFee = paymentMethod === 'creditcard' ? Number(((subtotal - discountAmount) * 0.05).toFixed(2)) : 0;
	const total = Number((subtotal + shippingCost - discountAmount + cardFee).toFixed(2));

	useEffect(() => {
		if (cartItems.length === 0 && !hasSubmitted) {
			router.push('/cart');
		}
	}, [cartItems.length, hasSubmitted, router]);

	const handleApplyPromo = async () => {
		if (!promoCode.trim()) return;
		setIsVerifyingPromo(true);
		setPromoError(null);

		try {
			const response = await fetch('/api/promo/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: promoCode }),
			});

			const data = await response.json();
			if (data.ok) {
				setAppliedDiscount(data.discount);
				setPromoError(null);
			} else {
				setPromoError(data.error || 'Invalid code');
				setAppliedDiscount(0);
			}
		} catch (error) {
			setPromoError('Failed to verify code');
		} finally {
			setIsVerifyingPromo(false);
		}
	};

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
					paymentMethod,
					cardFee,
					promoCode: appliedDiscount > 0 ? promoCode : undefined,
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
			<div className='max-w-7xl mx-auto px-6 py-24'>
				<Link
					href='/cart'
					className='text-deep-tidal-teal hover:text-eucalyptus mb-8 inline-block'>
					← Back to Cart
				</Link>
				<h1 className='text-4xl font-bold mb-8 text-deep-tidal-teal-800'>Checkout</h1>

				<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
					<div className='order-2 lg:order-1 lg:col-span-2'>
						<div className='bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 mb-6 shadow-lg'>
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
										autoComplete='given-name'
										className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										required
									/>
								</div>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Last name *</label>
									<input
										type='text'
										value={formData.lastName}
										onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
										autoComplete='family-name'
										className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										required
									/>
								</div>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Country / Region *</label>
									<select
										value={formData.country}
										onChange={(e) => setFormData({ ...formData, country: e.target.value })}
										autoComplete='country-name'
										className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
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
										autoComplete='address-line1'
										className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
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
										autoComplete='address-line2'
										className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
									/>
								</div>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Town / City *</label>
									<input
										type='text'
										value={formData.city}
										onChange={(e) => setFormData({ ...formData, city: e.target.value })}
										autoComplete='address-level2'
										className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										required
									/>
								</div>
								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Province *</label>
									<select
										value={formData.province}
										onChange={(e) => setFormData({ ...formData, province: e.target.value })}
										autoComplete='address-level1'
										className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
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
										autoComplete='postal-code'
										className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										required
									/>
								</div>

								<div>
									<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Email address *</label>
									<input
										type='email'
										value={formData.email}
										onChange={(e) => setFormData({ ...formData, email: e.target.value })}
										autoComplete='email'
										className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
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
									<div className='space-y-4 rounded-lg bg-mineral-white border border-black/10 p-4'>
										<div>
											<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Street address *</label>
											<input
												type='text'
												value={shippingAddress.address}
												onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })}
												placeholder='House number and street name'
												autoComplete='shipping address-line1'
												className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
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
												autoComplete='shipping address-line2'
												className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
											/>
										</div>
										<div>
											<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Town / City *</label>
											<input
												type='text'
												value={shippingAddress.city}
												onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
												autoComplete='shipping address-level2'
												className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
												required
											/>
										</div>
										<div>
											<label className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>Province *</label>
											<select
												value={shippingAddress.province}
												onChange={(e) => setShippingAddress({ ...shippingAddress, province: e.target.value })}
												autoComplete='shipping address-level1'
												className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
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
												autoComplete='shipping postal-code'
												className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
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
										className='w-full min-h-[120px] bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
									/>
								</div>
								<div className='pb-4 pt-0 border-b border-deep-tidal-teal/10'>
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
								<div className=' pb-4 border-b border-deep-tidal-teal/10'>
									<h3 className='font-semibold text-deep-tidal-teal-800 mb-2'>Interac e-Transfer</h3>
									<p className='text-sm text-deep-tidal-teal-800'>
										After placing your order, please send an Interac e-Transfer with the instructions provided. You will receive the question and password to complete the
										transfer.
									</p>
								</div>
								<div className='py-1'>
									<label className='flex items-center gap-3 cursor-pointer'>
										<input
											type='checkbox'
											checked={agreedToTerms}
											onChange={(e) => setAgreedToTerms(e.target.checked)}
											className='w-4 h-4 rounded border-deep-tidal-teal-300 text-deep-tidal-teal focus:ring-deep-tidal-teal'
											required
										/>
										<span className='text-sm text-deep-tidal-teal-800'>
											I have read and agree to the{' '}
											<button
												type='button'
												onClick={() => setShowTermsModal(true)}
												className='text-deep-tidal-teal hover:text-deep-tidal-teal-600 underline font-medium'>
												Terms & Conditions
											</button>
										</span>
									</label>
								</div>
								<button
									type='submit'
									disabled={isProcessing || !agreedToTerms}
									className='w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 disabled:bg-deep-tidal-teal disabled:cursor-not-allowed text-mineral-white font-semibold py-3 px-4 rounded transition-colors'>
									{isProcessing ? 'Processing...' : 'Place Order'}
								</button>
							</form>
						</div>
					</div>

					<div className='order-1 lg:order-2 lg:col-span-1'>
						<div className='bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 sticky top-24 shadow-lg'>
							<div className='flex items-center justify-between mb-4 pb-4 border-b border-deep-tidal-teal/10'>
								<h2 className='text-2xl font-bold text-deep-tidal-teal-800'>Your order</h2>
								<Link
									href='/cart'
									className='text-sm font-semibold text-deep-tidal-teal hover:text-deep-tidal-teal-600 transition-colors flex items-center gap-1'>
									<svg
										className='w-4 h-4'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
										/>
									</svg>
									<span className='text-sm font-semibold underline'>Edit Cart</span>
								</Link>
							</div>
							<div className='mb-4'>
								{cartItems.map((item, index) => (
									<div
										key={item.id}
										className={`flex items-center gap-3 ${index < cartItems.length - 1 ? 'pb-4 mb-4 border-b border-deep-tidal-teal/10' : ''}`}>
										{/* Product Image */}
										<div className='w-14 h-14 flex-shrink-0  rounded-lg overflow-hidden '>
											<Image
												src={item.image}
												alt={item.name}
												width={56}
												height={56}
												className='w-full h-full object-contain'
											/>
										</div>

										{/* Product Details & Price */}
										<div className='flex-1 min-w-0'>
											<h3 className='text-sm font-semibold text-deep-tidal-teal-800 leading-tight'>{item.name}</h3>
											<p className='text-base font-bold text-deep-tidal-teal mt-0.5'>
												${(getItemPrice(item) * item.quantity).toFixed(2)}
												{item.quantity > 1 && <span className='text-xs font-normal text-deep-tidal-teal-600 ml-1'>(${getItemPrice(item).toFixed(2)} ea)</span>}
											</p>
										</div>

										{/* Quantity Controls */}
										<div className='flex flex-col items-end gap-1.5'>
											<div className='flex items-center'>
												<button
													type='button'
													disabled={item.quantity <= 1}
													onClick={() => updateQuantity(item.id, item.quantity - 1)}
													className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-white w-7 h-7 rounded flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:hover:bg-deep-tidal-teal'>
													<Minus className='w-3 h-3' />
												</button>
												<span className='w-8 text-center text-sm font-medium text-deep-tidal-teal-800'>{item.quantity}</span>
												<button
													type='button'
													onClick={() => updateQuantity(item.id, item.quantity + 1)}
													className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-white w-7 h-7 rounded flex items-center justify-center transition-colors'>
													<Plus className='w-3 h-3' />
												</button>
											</div>
											<button
												type='button'
												onClick={() => removeFromCart(item.id)}
												className='text-xs text-red-500 hover:text-red-600 transition-colors'>
												Remove
											</button>
										</div>
									</div>
								))}
							</div>

							<div className='py-4'>
								{!showPromoInput ? (
									<button
										onClick={() => setShowPromoInput(true)}
										className='flex items-center gap-2 text-deep-tidal-teal-800 hover:text-deep-tidal-teal transition-colors group'>
										<svg
											className='w-5 h-5 transition-transform group-hover:scale-110'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={1.5}
												d='M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z'
											/>
										</svg>
										<span className='text-md font-bold underline decoration-1 underline-offset-4'>Enter a promo code</span>
									</button>
								) : (
									<div className='space-y-2 animate-in fade-in slide-in-from-top-2 duration-300'>
										<div className='flex gap-2'>
											<input
												type='text'
												value={promoCode}
												onChange={(e) => setPromoCode(e.target.value)}
												placeholder='Promo code'
												disabled={isVerifyingPromo || appliedDiscount > 0}
												className='flex-1 bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal/20 disabled:opacity-50'
											/>
											<button
												type='button'
												onClick={handleApplyPromo}
												disabled={isVerifyingPromo || appliedDiscount > 0 || !promoCode.trim()}
												className='bg-deep-tidal-teal text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-deep-tidal-teal-900 transition-colors disabled:opacity-50 cursor-pointer'>
												{isVerifyingPromo ? '...' : appliedDiscount > 0 ? 'Applied' : 'Apply'}
											</button>
											{appliedDiscount > 0 && (
												<button
													onClick={() => {
														setAppliedDiscount(0);
														setPromoCode('');
													}}
													className='text-xs text-red-500 underline'>
													Remove
												</button>
											)}
										</div>
										{promoError && <p className='text-xs text-red-500 font-medium'>{promoError}</p>}
										{appliedDiscount > 0 && <p className='text-xs text-deep-tidal-teal-400 font-bold'>Discount applied! {appliedDiscount}% off subtotal.</p>}
									</div>
								)}
							</div>

							<div className='border-t border-deep-tidal-teal/10 pt-4 space-y-2 text-sm'>
								<div className='flex justify-between'>
									<span className='text-deep-tidal-teal-700 text-lg'>Subtotal</span>
									<span className='text-deep-tidal-teal-800 font-semibold text-lg'>${subtotal.toFixed(2)}</span>
								</div>
								{appliedDiscount > 0 && (
									<div className='flex justify-between text-deep-tidal-teal font-bold'>
										<span className='text-lg'>Discount ({appliedDiscount}%)</span>
										<span className='text-lg'>-${discountAmount.toFixed(2)}</span>
									</div>
								)}
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
										<span className='text-lg'>${SHIPPING_COSTS.regular.toFixed(2)}</span>
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
										<span className='text-lg'>${SHIPPING_COSTS.express.toFixed(2)}</span>
									</label>
								</div>

								{/* Payment Method */}
								<div className='border-t border-deep-tidal-teal/10 pt-3 space-y-2'>
									<h4 className='text-sm font-semibold text-deep-tidal-teal-700 flex items-center gap-2'>
										<CreditCard className='w-4 h-4' />
										Payment Method
									</h4>
									<label className='flex items-center justify-between gap-2 text-deep-tidal-teal-800'>
										<span className='flex items-center gap-2'>
											<input
												type='radio'
												name='payment'
												checked={paymentMethod === 'etransfer'}
												onChange={() => setPaymentMethod('etransfer')}
											/>
											E-Transfer (Interac)
										</span>
										<span className='text-sm text-emerald-600'>No fee</span>
									</label>
									<label className='flex items-center justify-between gap-2 text-deep-tidal-teal-800'>
										<span className='flex items-center gap-2'>
											<input
												type='radio'
												name='payment'
												checked={paymentMethod === 'creditcard'}
												onChange={() => setPaymentMethod('creditcard')}
											/>
											Credit Card
										</span>
										<span className='text-sm text-deep-tidal-teal-500'>+5% fee</span>
									</label>
								</div>

								{/* Card Fee (if applicable) */}
								{cardFee > 0 && (
									<div className='flex justify-between text-sm text-deep-tidal-teal-600'>
										<span>Card Fee (5%)</span>
										<span>${cardFee.toFixed(2)}</span>
									</div>
								)}

								<div className='border-t border-deep-tidal-teal/10 pt-3 flex justify-between text-xl font-bold'>
									<span className='text-deep-tidal-teal-800'>Total</span>
									<span className='text-deep-tidal-teal'>${total.toFixed(2)}</span>
								</div>

								{/* Notices */}
								<div className='mt-6 pt-4 border-t border-deep-tidal-teal/10 space-y-3'>
									<div className='pt-3'>
										<h4 className='text-sm font-semibold text-deep-tidal-teal-700 mb-1 flex items-center gap-2'>
											<Truck className='w-4 h-4' />
											Shipping disclaimer
										</h4>
										<p className='text-xs text-deep-tidal-teal-600 leading-relaxed'>
											Not responsible for errant shipments due to incorrect addresses. Please double check your address is correct.
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Terms & Conditions Modal */}
			{showTermsModal && (
				<div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
					<div className='bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-2xl'>
						<div className='p-6 border-b border-gray-200 flex items-center justify-between'>
							<h2 className='text-2xl font-bold text-deep-tidal-teal-800'>Terms & Conditions</h2>
							<button
								onClick={() => setShowTermsModal(false)}
								className='text-gray-500 hover:text-gray-700 text-2xl leading-none'>
								×
							</button>
						</div>
						<div className='p-6 overflow-y-auto max-h-[60vh] text-deep-tidal-teal-800'>
							<TermsContent />
						</div>
						<div className='p-6 border-t border-gray-200 flex justify-end gap-3'>
							<button
								onClick={() => setShowTermsModal(false)}
								className='px-6 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium transition-colors'>
								Close
							</button>
							<button
								onClick={() => {
									setAgreedToTerms(true);
									setShowTermsModal(false);
								}}
								className='px-6 py-2 rounded bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-white font-medium transition-colors'>
								I Agree
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
