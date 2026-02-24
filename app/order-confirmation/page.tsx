import Link from 'next/link';
import Header from '@/components/Header';
import { OrderConfirmationCartClear } from '@/components/OrderConfirmationCartClear';
import { getOrderByOrderNumberFromDb } from '@/lib/ordersDb';

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
	securityQuestion: 'Order number no.',
	securityAnswerPrefix: 'PT',
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

export default async function OrderConfirmationPage({ searchParams }: { searchParams: Promise<{ orderNumber?: string }> }) {
	const { orderNumber: queryOrderNumber } = await searchParams;
	const order = queryOrderNumber?.trim() ? await getOrderByNumber(queryOrderNumber) : null;

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

	if (order.paymentStatus === 'pending') {
		return (
			<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
				<Header />
				<div className='max-w-7xl mx-auto px-6 py-24'>
					<div className='max-w-2xl mx-auto bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 shadow-lg'>
						<h1 className='text-4xl font-bold text-deep-tidal-teal-800 mb-6'>Processing your payment</h1>
						<p className='text-deep-tidal-teal-800 mb-6'>
							Your order was received. Payment is being processed. This page will update when payment is confirmed, or you can check back shortly.
						</p>
						<Link
							href='/'
							className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors inline-block'>
							Return to shop
						</Link>
					</div>
				</div>
			</div>
		);
	}

	const orderNumber = order.orderNumber ?? order.createdAt.replace(/\D/g, '').slice(-6);
	const orderDate = new Date(order.createdAt).toLocaleDateString('en-CA', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
	const paymentMethod = order.paymentMethod;
	const isCreditCardOrder = paymentMethod === 'creditcard';
	const shippingLabel = order.shippingMethod === 'express' ? 'Express Shipping' : '';
	const billingAddressLines = [
		`${order.customer.firstName} ${order.customer.lastName}`,
		order.customer.address,
		order.customer.addressLine2,
		`${order.customer.city} ${order.customer.province} ${order.customer.zipCode}`,
		order.customer.country,
		order.customer.email,
	].filter(Boolean);
	const shippingAddressSource = order.shipToDifferentAddress && order.shippingAddress ? order.shippingAddress : order.customer;
	const shippingAddressLines = [
		`${order.customer.firstName} ${order.customer.lastName}`,
		shippingAddressSource.address,
		shippingAddressSource.addressLine2,
		`${shippingAddressSource.city} ${shippingAddressSource.province} ${shippingAddressSource.zipCode}`,
	].filter(Boolean);

	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<OrderConfirmationCartClear
				orderNumber={orderNumber}
				paymentStatus={order.paymentStatus ?? undefined}
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
							<div className='text-deep-tidal-teal-800 font-semibold'>{formatMoney(order.total)}</div>
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
									<div className='text-deep-tidal-teal-800 font-semibold'>
										{paymentDetails.securityAnswerPrefix}
										{orderNumber}
									</div>
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
								{order.cartItems.map((item, index) => (
									<div
										key={item.id}
										className={`flex justify-between items-center text-deep-tidal-teal-800 ${index < order.cartItems.length - 1 ? 'pb-4 mb-4 border-b border-deep-tidal-teal/10' : ''}`}>
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
									<span className='text-deep-tidal-teal-800 font-semibold'>{formatMoney(order.subtotal)}</span>
								</div>
								{order.discountAmount != null && order.discountAmount > 0 && (
									<div className='flex justify-between text-deep-tidal-teal-700'>
										<span>Discount{order.promoCode ? ` (${order.promoCode})` : ''}</span>
										<span className='text-deep-tidal-teal-800 font-semibold'>-{formatMoney(order.discountAmount)}</span>
									</div>
								)}
								<div className='flex justify-between text-deep-tidal-teal-700'>
									<span>Shipping</span>
									<span className='text-deep-tidal-teal-800 font-semibold'>
										{formatMoney(order.shippingCost)} via {shippingLabel}
									</span>
								</div>
								<div className='flex justify-between text-xl font-bold pt-3 border-t border-deep-tidal-teal/10'>
									<span className='text-deep-tidal-teal-800'>Total</span>
									<span className='text-deep-tidal-teal'>{formatMoney(order.total)}</span>
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
