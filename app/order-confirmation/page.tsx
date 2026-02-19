import Link from 'next/link';
import Header from '@/components/Header';
import { getOrderByOrderNumberFromDb, listOrdersFromDb } from '@/lib/ordersDb';

// Force dynamic rendering - don't cache this page
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Order = {
	orderNumber?: string;
	createdAt: string;
	customer: {
		firstName: string;
		lastName: string;
		country: string;
		email: string;
		phone: string;
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
	recipientEmail: 'payments@puretide.ca',
	securityQuestion: 'Order number?',
	securityAnswerPrefix: 'PT',
	supportEmail: 'info@puretide.ca',
};

const formatMoney = (value: number) =>
	new Intl.NumberFormat('en-CA', {
		style: 'currency',
		currency: 'CAD',
	}).format(value);

type OrderWithPayment = Order & { paymentStatus?: string };

async function getOrders(): Promise<OrderWithPayment[]> {
	return listOrdersFromDb() as OrderWithPayment[];
}

async function getOrderByNumber(orderNumber: string | null): Promise<OrderWithPayment | null> {
	if (!orderNumber?.trim()) return null;
	return getOrderByOrderNumberFromDb(orderNumber.trim()) as OrderWithPayment | null;
}

export default async function OrderConfirmationPage({ searchParams }: { searchParams: Promise<{ orderNumber?: string }> }) {
	const { orderNumber: queryOrderNumber } = await searchParams;
	const order = queryOrderNumber ? await getOrderByNumber(queryOrderNumber) : ((await getOrders()).at(-1) ?? null);

	if (!order) {
		return (
			<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
				<Header />
				<div className='max-w-7xl mx-auto px-6 py-16 pt-28'>
					<div className='max-w-2xl mx-auto bg-eucalyptus-100/60 backdrop-blur-sm rounded-lg ui-border p-4 shadow-lg'>
						<h1 className='text-3xl font-bold text-deep-tidal-teal-800 mb-3'>Order not found</h1>
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
				<div className='max-w-7xl mx-auto px-6 py-16 pt-28'>
					<div className='max-w-2xl mx-auto bg-eucalyptus-100/60 backdrop-blur-sm rounded-lg ui-border p-4 shadow-lg'>
						<h1 className='text-3xl font-bold text-deep-tidal-teal-800 mb-3'>Processing your payment</h1>
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
	const paymentMethod = (order as Record<string, unknown>).paymentMethod;
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
			<Header />
			<div className='max-w-7xl mx-auto px-6 py-12 pt-28'>
				<div className='max-w-4xl mx-auto bg-muted-sage/30 backdrop-blur-sm rounded-lg ui-border shadow-lg p-6'>
					<h1 className='text-3xl font-bold text-deep-tidal-teal-800 mb-2 mt-2'>Thank you. Your order has been received.</h1>
					<p className='text-deep-tidal-teal-800 mb-6'>
						{isCreditCardOrder
							? 'Your credit card payment has been received.'
							: 'Payment is completed only via Interac e&ndash;Transfer in Canada.'}
					</p>

					<div className='grid grid-cols-1 md:grid-cols-4 gap-4 text-md mb-8'>
						<div className='bg-mineral-white rounded-lg ui-border p-4'>
							<div className='text-deep-tidal-teal-600'>Order number</div>
							<div className='text-deep-tidal-teal-800 font-semibold'>{orderNumber}</div>
						</div>
						<div className='bg-mineral-white rounded-lg ui-border p-4'>
							<div className='text-deep-tidal-teal-600'>Date</div>
							<div className='text-deep-tidal-teal-800 font-semibold'>{orderDate}</div>
						</div>
						<div className='bg-mineral-white rounded-lg ui-border p-4'>
							<div className='text-deep-tidal-teal-600'>Total</div>
							<div className='text-deep-tidal-teal-800 font-semibold'>{formatMoney(order.total)}</div>
						</div>
						<div className='bg-mineral-white rounded-lg ui-border p-4'>
							<div className='text-deep-tidal-teal-600'>Payment method</div>
							<div className='text-deep-tidal-teal-800 font-semibold'>{isCreditCardOrder ? 'Credit card' : 'Interac e-Transfer'}</div>
						</div>
					</div>

					{!isCreditCardOrder && (
						<div className='rounded-lg bg-mineral-white ui-border mb-8 p-4'>
							<h2 className='text-2xl font-semibold text-deep-tidal-teal-800 mb-4'>Interac e&ndash;Transfer Instructions</h2>
							<p className='text-deep-tidal-teal-800 mb-4'>
								After placing your order, please send an Interac e&ndash;Transfer following the instructions below. Enter everything exactly as shown so your payment is
								automatically accepted.
							</p>
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-md'>
								<div>
									<div className='text-deep-tidal-teal-600'>Recipient Name</div>
									<div className='text-deep-tidal-teal-800 font-semibold'>{paymentDetails.recipientName}</div>
								</div>
								<div>
									<div className='text-deep-tidal-teal-600'>Recipient Email</div>
									<div className='text-deep-tidal-teal-800 font-semibold'>{paymentDetails.recipientEmail}</div>
								</div>
								<div>
									<div className='text-deep-tidal-teal-600'>Security Question</div>
									<div className='text-deep-tidal-teal-800 font-semibold'>{paymentDetails.securityQuestion}</div>
								</div>
								<div>
									<div className='text-deep-tidal-teal-600'>Security Answer</div>
									<div className='text-deep-tidal-teal-800 font-semibold'>
										{paymentDetails.securityAnswerPrefix}
										{orderNumber}
									</div>
								</div>
								<div>
									<div className='text-deep-tidal-teal-600'>Memo / Message</div>
									<div className='text-deep-tidal-teal-800 font-semibold'>{orderNumber}</div>
								</div>
							</div>
							<div className='text-xs text-deep-tidal-teal-700 mt-4 space-y-2'>
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

					<div className='grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8'>
						<div className='bg-mineral-white rounded-lg ui-border p-4'>
							<h3 className='text-lg font-semibold text-deep-tidal-teal-800 mb-3'>Order details</h3>
							<div className='space-y-3 text-md'>
								{order.cartItems.map((item) => (
									<div
										key={item.id}
										className='flex justify-between text-deep-tidal-teal-700'>
										<span>
											{item.name} × {item.quantity}
										</span>
										<span className='text-deep-tidal-teal-800 font-semibold'>{formatMoney(item.price * item.quantity)}</span>
									</div>
								))}
							</div>
							<div className='ui-border-t mt-4 pt-4 space-y-2 text-md'>
								<div className='flex justify-between text-deep-tidal-teal-700'>
									<span>Subtotal</span>
									<span className='text-deep-tidal-teal-800 font-semibold'>{formatMoney(order.subtotal)}</span>
								</div>
								<div className='flex justify-between text-deep-tidal-teal-700'>
									<span>Shipping</span>
									<span className='text-deep-tidal-teal-800 font-semibold'>
										{formatMoney(order.shippingCost)} via {shippingLabel}
									</span>
								</div>
								<div className='flex justify-between text-deep-tidal-teal-800 font-semibold'>
									<span>Total</span>
									<span>{formatMoney(order.total)}</span>
								</div>
							</div>
						</div>
						<div className='space-y-4'>
							<div className='bg-mineral-white rounded-lg ui-border p-4'>
								<h3 className='text-lg font-semibold text-deep-tidal-teal-800 mb-3'>Billing address</h3>
								<div className='text-md text-deep-tidal-teal-700 space-y-1'>
									{billingAddressLines.map((line) => (
										<div key={line}>{line}</div>
									))}
								</div>
							</div>
							<div className='bg-mineral-white rounded-lg ui-border p-4'>
								<h3 className='text-lg font-semibold text-deep-tidal-teal-800 mb-3'>Shipping address</h3>
								<div className='text-md text-deep-tidal-teal-700 space-y-1'>
									{shippingAddressLines.map((line) => (
										<div key={line}>{line}</div>
									))}
								</div>
							</div>
						</div>
					</div>

					<div className='text-xs text-deep-tidal-teal-700 p-[6px]'>
						<p>Your personal data will be used to process your order, support your experience on this website, and for other purposes described in our privacy policy.</p>
						<p>Products are for research use only and are not intended for human or animal consumption.</p>
					</div>
				</div>
			</div>
		</div>
	);
}
