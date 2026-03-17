import Link from 'next/link';
import Header from '@/components/Header';
import { OrderConfirmationCartClear } from '@/components/OrderConfirmationCartClear';
import { AutoRefresh } from '@/components/AutoRefresh';
import { getOrderByOrderNumberFromDb, upsertOrderInDb } from '@/lib/ordersDb';
import { verifyOrderConfirmationToken } from '@/lib/orderConfirmationToken';

// Force dynamic rendering - don't cache this page
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Order = {
	orderNumber?: string;
	createdAt: string;
	paymentMethod?: string;
	paymentStatus?: string;
	customer: {
		firstName: string;
		lastName: string;
		country: string;
		email: string;
		address: string;
		addressLine2: string;
		city: string;
		province: string;
		zipCode: string;
		orderNotes: string;
	};
	shipToDifferentAddress: boolean;
	shippingAddress?: {
		address: string;
		addressLine2: string;
		city: string;
		province: string;
		zipCode: string;
	};
	shippingMethod: 'express';
	subtotal: number;
	shippingCost: number;
	discountAmount?: number;
	promoCode?: string;
	total: number;
	cartItems: Array<{
		id: number;
		name: string;
		price: number;
		quantity: number;
		image: string;
		description: string;
	}>;
};

const paymentDetails = {
	recipientName: 'Pure Tide Payments',
	recipientEmail: 'orders@puretide.ca',
	securityQuestion: 'Order number',
	securityAnswerPrefix: '',
	supportEmail: 'info@puretide.ca',
};

const formatMoney = (value: number) =>
	new Intl.NumberFormat('en-CA', {
		style: 'currency',
		currency: 'CAD',
	}).format(value);

async function getOrderByNumber(orderNumber: string | null): Promise<Order | null> {
	if (!orderNumber?.trim()) return null;
	return (await getOrderByOrderNumberFromDb(orderNumber.trim())) as Order | null;
}

function normalizeProviderStatus(value: unknown): string {
	return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isApprovedProviderStatus(statusRaw: string): boolean {
	return statusRaw === 'approved' || statusRaw === 'success' || statusRaw === 'completed';
}

export default async function OrderConfirmationPage({ searchParams }: { searchParams: Promise<{ orderNumber?: string; token?: string; status?: string; result?: string }> }) {
	const { orderNumber: queryOrderNumber, token, status, result } = await searchParams;
	const orderNumberParam = queryOrderNumber?.trim();
	const isAllowed = orderNumberParam ? verifyOrderConfirmationToken(orderNumberParam, token?.trim()) : false;
	let order = isAllowed && orderNumberParam ? await getOrderByNumber(orderNumberParam) : null;

	if (!order) {
		return (
			<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
				<Header />
				<div className='max-w-7xl mx-auto px-6 py-24'>
					<div className='max-w-2xl mx-auto bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 shadow-lg'>
						<h1 className='text-4xl font-bold text-deep-tidal-teal-800 mb-6'>Order not found</h1>
						<p className='text-deep-tidal-teal-800 mb-6'>We could not find a recent order. Please return to the shop.</p>
						<Link
							href='/'
							className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors inline-block'>
							Continue shopping
						</Link>
					</div>
				</div>
			</div>
		);
	}

	const paymentProvider = (order as unknown as Record<string, unknown>).paymentProvider;
	const isDigipayOrder = paymentProvider === 'digipay' || order.paymentMethod === 'creditcard';
	const providerStatusRaw = normalizeProviderStatus(status) || normalizeProviderStatus(result);
	const hasExplicitProviderStatus = Boolean(providerStatusRaw);

	// CLIENT-SIDE FALLBACK: If DigiPay returns explicit non-approved status, show failure immediately
	// This ensures users always see the right message on first load, even if server update fails
	if (isDigipayOrder && hasExplicitProviderStatus && !isApprovedProviderStatus(providerStatusRaw)) {
		return (
			<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
				<Header />
				<div className='max-w-7xl mx-auto px-6 py-24'>
					<div className='max-w-2xl mx-auto bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 shadow-lg'>
						<h1 className='text-4xl font-bold text-deep-tidal-teal-800 mb-6'>Payment not completed</h1>
						<p className='text-deep-tidal-teal-800 mb-6'>
							Your order was received, but the payment was not completed. No charge was captured. Please try again or contact support if you need help.
						</p>
						<div className='flex flex-col sm:flex-row gap-3'>
							<Link
								href='/checkout'
								className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors inline-block text-center'>
								Try again
							</Link>
							<Link
								href='/'
								className='bg-transparent hover:bg-deep-tidal-teal/5 text-deep-tidal-teal font-semibold py-3 px-6 rounded transition-colors inline-block text-center border border-deep-tidal-teal/20'>
								Return to shop
							</Link>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// If the customer returns from DigiPay with an explicit non-approved status, persist failure so we don't show "processing".
	if (order.paymentStatus === 'pending' && isDigipayOrder && hasExplicitProviderStatus && !isApprovedProviderStatus(providerStatusRaw)) {
		await upsertOrderInDb({
			...(order as unknown as Record<string, unknown>),
			paymentStatus: 'failed',
			paymentFailure: {
				reason: 'return_not_approved',
				providerStatus: providerStatusRaw,
				updatedAt: new Date().toISOString(),
			},
		} as Record<string, unknown>);
		order = { ...(order as Order), paymentStatus: 'failed' };
	}

	if (order.paymentStatus === 'pending') {
		const createdAtMs = Date.parse(order.createdAt);
		const isStale = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs > 15 * 60 * 1000 : false;
		if (isDigipayOrder && isStale) {
			return (
				<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
					<Header />
					<div className='max-w-7xl mx-auto px-6 py-24'>
						<div className='max-w-2xl mx-auto bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 shadow-lg'>
							<h1 className='text-4xl font-bold text-deep-tidal-teal-800 mb-6'>Payment not confirmed</h1>
							<p className='text-deep-tidal-teal-800 mb-6'>
								Your order was received, but we could not confirm your card payment. This can happen if the payment was declined or canceled. Please try again.
							</p>
							<div className='flex flex-col sm:flex-row gap-3'>
								<Link
									href='/checkout'
									className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors inline-block text-center'>
									Try again
								</Link>
								<Link
									href='/'
									className='bg-transparent hover:bg-deep-tidal-teal/5 text-deep-tidal-teal font-semibold py-3 px-6 rounded transition-colors inline-block text-center border border-deep-tidal-teal/20'>
									Return to shop
								</Link>
							</div>
						</div>
					</div>
				</div>
			);
		}

		return (
			<AutoRefresh
				interval={5000}
				maxRefreshes={24}>
				{(refreshCount) => (
					<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
						<Header />
						<div className='max-w-7xl mx-auto px-6 py-24'>
							<div className='max-w-2xl mx-auto bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 shadow-lg'>
								<h1 className='text-4xl font-bold text-deep-tidal-teal-800 mb-6'>Processing your payment</h1>
								<p className='text-deep-tidal-teal-800 mb-4'>
									Your order was received. Payment is being processed. This page will update when payment is confirmed, or you can check back shortly.
								</p>
								{refreshCount > 1 && <p className='text-deep-tidal-teal-600 text-sm mb-4'>Checking for payment update... (refresh {refreshCount}/24)</p>}
								<Link
									href='/'
									className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors inline-block'>
									Return to shop
								</Link>
							</div>
						</div>
					</div>
				)}
			</AutoRefresh>
		);
	}

	if (order.paymentStatus === 'failed') {
		return (
			<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
				<Header />
				<div className='max-w-7xl mx-auto px-6 py-24'>
					<div className='max-w-2xl mx-auto bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 shadow-lg'>
						<h1 className='text-4xl font-bold text-deep-tidal-teal-800 mb-6'>Payment not completed</h1>
						<p className='text-deep-tidal-teal-800 mb-6'>
							Your order was received, but the payment was not completed. No charge was captured. Please try again or contact support if you need help.
						</p>
						<div className='flex flex-col sm:flex-row gap-3'>
							<Link
								href='/checkout'
								className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors inline-block text-center'>
								Try again
							</Link>
							<Link
								href='/'
								className='bg-transparent hover:bg-deep-tidal-teal/5 text-deep-tidal-teal font-semibold py-3 px-6 rounded transition-colors inline-block text-center border border-deep-tidal-teal/20'>
								Return to shop
							</Link>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Only show success confirmation for paid orders
	if (order.paymentStatus !== 'paid') {
		return (
			<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
				<Header />
				<div className='max-w-7xl mx-auto px-6 py-24'>
					<div className='max-w-2xl mx-auto bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 shadow-lg'>
						<h1 className='text-4xl font-bold text-deep-tidal-teal-800 mb-6'>Payment not completed</h1>
						<p className='text-deep-tidal-teal-800 mb-6'>
							Your order was received, but the payment was not completed. No charge was captured. Please try again or contact support if you need help.
						</p>
						<div className='flex flex-col sm:flex-row gap-3'>
							<Link
								href='/checkout'
								className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors inline-block text-center'>
								Try again
							</Link>
							<Link
								href='/'
								className='bg-transparent hover:bg-deep-tidal-teal/5 text-deep-tidal-teal font-semibold py-3 px-6 rounded transition-colors inline-block text-center border border-deep-tidal-teal/20'>
								Return to shop
							</Link>
						</div>
					</div>
				</div>
			</div>
		);
	}

	const confirmedOrder = order;

	const orderNumber = confirmedOrder.orderNumber ?? confirmedOrder.createdAt.replace(/\D/g, '').slice(-6);
	const orderDate = new Date(confirmedOrder.createdAt).toLocaleDateString('en-CA', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
	const paymentMethod = confirmedOrder.paymentMethod;
	const isCreditCardOrder = paymentMethod === 'creditcard';
	const securityAnswer = `${paymentDetails.securityAnswerPrefix}${orderNumber}`;
	const shippingLabel = confirmedOrder.shippingMethod === 'express' ? 'Express Shipping' : '';
	const billingAddressLines = [
		`${confirmedOrder.customer.firstName} ${confirmedOrder.customer.lastName}`,
		confirmedOrder.customer.address,
		confirmedOrder.customer.addressLine2,
		`${confirmedOrder.customer.city} ${confirmedOrder.customer.province} ${confirmedOrder.customer.zipCode}`,
		confirmedOrder.customer.country,
		confirmedOrder.customer.email,
	].filter(Boolean);
	const shippingAddressSource = confirmedOrder.shipToDifferentAddress && confirmedOrder.shippingAddress ? confirmedOrder.shippingAddress : confirmedOrder.customer;
	const shippingAddressLines = [
		`${confirmedOrder.customer.firstName} ${confirmedOrder.customer.lastName}`,
		shippingAddressSource.address,
		shippingAddressSource.addressLine2,
		`${shippingAddressSource.city} ${shippingAddressSource.province} ${shippingAddressSource.zipCode}`,
	].filter(Boolean);

	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<OrderConfirmationCartClear
				orderNumber={orderNumber}
				paymentStatus={confirmedOrder.paymentStatus ?? undefined}
			/>
			<Header />
			<div className='max-w-7xl mx-auto pt-40 pb-6 py-24'>
				<div className='max-w-4xl mx-auto bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 shadow-lg'>
					<h1 className='text-4xl font-bold mb-8 text-deep-tidal-teal-800'>Thank you. Your order has been received.</h1>
					<p className='text-deep-tidal-teal-800 mb-8'>
						{isCreditCardOrder ? 'Your credit card payment has been received.' : 'Payment is completed only via Interac e-Transfer in Canada.'}
					</p>

					<div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-8'>
						<div className='rounded-lg border border-deep-tidal-teal/10 p-4'>
							<div className='text-sm text-deep-tidal-teal-600 mb-1'>Order number</div>
							<div className='text-deep-tidal-teal-800 font-semibold'>{orderNumber}</div>
						</div>
						<div className='rounded-lg border border-deep-tidal-teal/10 p-4'>
							<div className='text-sm text-deep-tidal-teal-600 mb-1'>Date</div>
							<div className='text-deep-tidal-teal-800 font-semibold'>{orderDate}</div>
						</div>
						<div className='rounded-lg border border-deep-tidal-teal/10 p-4'>
							<div className='text-sm text-deep-tidal-teal-600 mb-1'>Total</div>
							<div className='text-deep-tidal-teal-800 font-semibold'>{formatMoney(confirmedOrder.total)}</div>
						</div>
						<div className='rounded-lg border border-deep-tidal-teal/10 p-4'>
							<div className='text-sm text-deep-tidal-teal-600 mb-1'>Payment method</div>
							<div className='text-deep-tidal-teal-800 font-semibold'>{isCreditCardOrder ? 'Credit card' : 'Interac e-Transfer'}</div>
						</div>
					</div>

					{!isCreditCardOrder && (
						<div className='mb-8 pt-8 border-t border-deep-tidal-teal/10'>
							<h2 className='text-2xl font-bold text-deep-tidal-teal-800 mb-4 pb-4 border-b border-deep-tidal-teal/10'>Interac e&ndash;Transfer Instructions</h2>
							<p className='text-sm text-deep-tidal-teal-800 mb-4'>
								After placing your order, please send an Interac e&ndash;Transfer following the instructions below. Enter everything exactly as shown so your payment is
								automatically accepted.
							</p>
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								<div>
									<div className='text-sm text-deep-tidal-teal-600 mb-1'>Recipient Name</div>
									<div className='text-deep-tidal-teal-800 font-semibold'>{paymentDetails.recipientName}</div>
								</div>
								<div>
									<div className='text-sm text-deep-tidal-teal-600 mb-1'>Recipient Email</div>
									<div className='text-deep-tidal-teal-800 font-semibold'>{paymentDetails.recipientEmail}</div>
								</div>
								<div>
									<div className='text-sm text-deep-tidal-teal-600 mb-1'>Security Question</div>
									<div className='text-deep-tidal-teal-800 font-semibold'>{paymentDetails.securityQuestion}</div>
								</div>
								<div>
									<div className='text-sm text-deep-tidal-teal-600 mb-1'>Security Answer</div>
									<div className='text-deep-tidal-teal-800 font-semibold'>{securityAnswer}</div>
								</div>

								<div>
									<div className='text-sm text-deep-tidal-teal-600 mb-1'>Memo / Message</div>
									<div className='text-deep-tidal-teal-800 font-semibold'>{orderNumber}</div>
								</div>
							</div>
							<div className='text-xs text-deep-tidal-teal-600 mt-4 pt-4 border-t border-deep-tidal-teal/10 space-y-2'>
								<p>Important: Use the exact Security Question and Answer above. Any changes can delay payment acceptance or have your payment refused.</p>
								<p>If your bank does not allow a memo, you can leave it empty.</p>
								<p>We only accept e&ndash;Transfers sent to the email listed above. Do not send payments to any other email address.</p>
								<p>If your payment is not accepted, please go to your banking app, cancel and re&ndash;send with the correct instructions above.</p>
								<p>
									Should you encounter any payment&ndash;related issues, please contact our support at: <span className='font-semibold'>{paymentDetails.supportEmail}</span>
								</p>
							</div>
						</div>
					)}

					<div className='grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8 border-t border-deep-tidal-teal/10'>
						<div className='lg:col-span-2'>
							<h2 className='text-2xl font-bold text-deep-tidal-teal-800 mb-4 pb-4 border-b border-deep-tidal-teal/10'>Order details</h2>
							<div className='space-y-4'>
								{confirmedOrder.cartItems.map((item, index) => (
									<div
										key={item.id}
										className={`flex justify-between items-center text-deep-tidal-teal-800 ${index < confirmedOrder.cartItems.length - 1 ? 'pb-4 mb-4 border-b border-deep-tidal-teal/10' : ''}`}>
										<span className='font-medium'>
											{item.name} × {item.quantity}
										</span>
										<span className='font-semibold text-deep-tidal-teal'>{formatMoney(item.price * item.quantity)}</span>
									</div>
								))}
							</div>
							<div className='border-t border-deep-tidal-teal/10 pt-4 mt-4 space-y-2 text-sm'>
								<div className='flex justify-between text-deep-tidal-teal-700'>
									<span>Subtotal</span>
									<span className='text-deep-tidal-teal-800 font-semibold'>{formatMoney(confirmedOrder.subtotal)}</span>
								</div>
								{confirmedOrder.discountAmount != null && confirmedOrder.discountAmount > 0 && (
									<div className='flex justify-between text-deep-tidal-teal-700'>
										<span>Discount{confirmedOrder.promoCode ? ` (${confirmedOrder.promoCode})` : ''}</span>
										<span className='text-deep-tidal-teal-800 font-semibold'>-{formatMoney(confirmedOrder.discountAmount)}</span>
									</div>
								)}
								<div className='flex justify-between text-deep-tidal-teal-700'>
									<span>Shipping</span>
									<span className='text-deep-tidal-teal-800 font-semibold'>
										{formatMoney(confirmedOrder.shippingCost)} via {shippingLabel}
									</span>
								</div>
								<div className='flex justify-between text-xl font-bold pt-3 border-t border-deep-tidal-teal/10'>
									<span className='text-deep-tidal-teal-800'>Total</span>
									<span className='text-deep-tidal-teal'>{formatMoney(confirmedOrder.total)}</span>
								</div>
							</div>
						</div>
						<div className='space-y-6'>
							<div>
								<h3 className='text-2xl font-bold text-deep-tidal-teal-800 mb-4 pb-4 border-b border-deep-tidal-teal/10'>Billing address</h3>
								<div className='text-sm text-deep-tidal-teal-700 space-y-1'>
									{billingAddressLines.map((line) => (
										<div key={line}>{line}</div>
									))}
								</div>
							</div>
							<div>
								<h3 className='text-2xl font-bold text-deep-tidal-teal-800 mb-4 pb-4 border-b border-deep-tidal-teal/10'>Shipping address</h3>
								<div className='text-sm text-deep-tidal-teal-700 space-y-1'>
									{shippingAddressLines.map((line) => (
										<div key={line}>{line}</div>
									))}
								</div>
							</div>
						</div>
					</div>

					<div className='mt-8 pt-6 border-t border-deep-tidal-teal/10 text-xs text-deep-tidal-teal-600 space-y-2'>
						<p>Your personal data will be used to process your order, support your experience on this website, and for other purposes described in our privacy policy.</p>
						<p>Products are for research use only and are not intended for human or animal consumption.</p>
					</div>
					<div className='mt-8'>
						<Link
							href='/'
							className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors inline-block'>
							Continue shopping
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
