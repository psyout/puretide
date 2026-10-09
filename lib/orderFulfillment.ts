import { buildOrderEmails } from '@/lib/orderEmail';
import { sendMail } from '@/lib/email';
import { DEFAULT_ORDER_NOTIFICATION_EMAIL } from '@/lib/constants';
import { createOrderTask, createClientTask } from '@/lib/wrike';
import { upsertSheetClient } from '@/lib/stockSheet';
import { readProducts } from '@/lib/productCatalog';
import { decrementZohoStock } from '@/lib/zohoInventory';

export type FulfillmentOrder = {
	orderNumber: string;
	createdAt: string;
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
	paymentMethod?: 'etransfer' | 'creditcard';
	paymentPath?: 'manual' | 'bluepeak' | 'manual_friends_family';
	etransfer?: {
		provider?: string;
		depositEmail?: string;
	};
	subtotal: number;
	shippingCost: number;
	discountAmount?: number;
	promoCode?: string;
	total: number;
	cartItems: Array<{
		id: string;
		name: string;
		price: number;
		quantity: number;
		image?: string;
		description?: string;
	}>;
};

export type EmailStatus = {
	sent: boolean;
	skipped: boolean;
	error?: string;
};

function getOrderNotificationRecipient() {
	return DEFAULT_ORDER_NOTIFICATION_EMAIL;
}

async function getZohoStockSnapshot(items: FulfillmentOrder['cartItems']): Promise<Array<{ name: string; stock: number; cost: number }>> {
	const products = await readProducts();
	const bySlug = new Map(products.map((product) => [product.slug, product] as const));
	return items.map((item) => {
		const product = bySlug.get(String(item.id));
		if (!product) throw new Error(`Zoho product not found for website slug: ${String(item.id)}`);
		return {
			name: item.name,
			stock: Math.max(0, product.stock - item.quantity),
			cost: Number(product.cost ?? 0),
		};
	});
}

export type RunFulfillmentResult = {
	emailStatus: EmailStatus;
	adminEmailStatus: EmailStatus;
};

export type RunFulfillmentOptions = {
	paymentConfirmed?: boolean;
	skipOrderTask?: boolean;
	sendCustomerEmail?: boolean;
	sendAdminEmail?: boolean;
};

export async function sendPendingManualEtransferNotifications(order: FulfillmentOrder): Promise<RunFulfillmentResult> {
	const emailData = buildOrderEmails({
		orderNumber: order.orderNumber,
		createdAt: order.createdAt,
		paymentMethod: 'etransfer',
		paymentConfirmed: false,
		etransferProvider: 'manual',
		paymentPath: order.paymentPath,
		customer: order.customer,
		shipToDifferentAddress: order.shipToDifferentAddress,
		shippingAddress: order.shippingAddress,
		shippingMethod: order.shippingMethod,
		subtotal: order.subtotal,
		shippingCost: order.shippingCost,
		discountAmount: order.discountAmount,
		promoCode: order.promoCode,
		total: order.total,
		cartItems: order.cartItems.map((item) => ({
			id: item.id,
			name: item.name,
			price: item.price,
			quantity: item.quantity,
		})),
	});
	const customerReplyTo = `${order.customer.firstName} ${order.customer.lastName} <${order.customer.email}>`;
	const customerResult = await sendMail({
		to: order.customer.email,
		from: process.env.ORDER_FROM ?? 'orders@puretide.ca',
		subject: emailData.customer.subject,
		text: emailData.customer.text,
		html: emailData.customer.html,
		replyTo: customerReplyTo,
	});
	const adminResult = await sendMail({
		to: getOrderNotificationRecipient(),
		from: process.env.ORDER_FROM ?? 'orders@puretide.ca',
		subject: emailData.admin.subject,
		text: emailData.admin.text,
		html: emailData.admin.html,
		replyTo: customerReplyTo,
	});
	return {
		emailStatus: customerResult.sent ? { sent: true, skipped: false } : { sent: false, skipped: false, error: customerResult.error },
		adminEmailStatus: adminResult.sent ? { sent: true, skipped: false } : { sent: false, skipped: false, error: adminResult.error },
	};
}

export async function runFulfillment(order: FulfillmentOrder, options: RunFulfillmentOptions = {}): Promise<RunFulfillmentResult> {
	console.log(JSON.stringify({ label: 'fulfillment:start', orderNumber: order.orderNumber }));
	const paymentMethod = (order as Record<string, unknown>).paymentMethod as 'etransfer' | 'creditcard' | undefined;
	const paymentPath = (order as Record<string, unknown>).paymentPath as 'manual' | 'bluepeak' | 'manual_friends_family' | undefined;
	const paymentConfirmed = options.paymentConfirmed ?? true;
	const etransfer = (order as Record<string, unknown>).etransfer as Record<string, unknown> | undefined;
	const etransferProvider = typeof etransfer?.provider === 'string' ? (etransfer.provider === 'bluepeak' ? 'bluepeak' : 'manual') : undefined;
	const paymentRecipientEmail = typeof etransfer?.depositEmail === 'string' ? etransfer.depositEmail : undefined;
	const emailData = buildOrderEmails({
		orderNumber: order.orderNumber,
		createdAt: order.createdAt,
		paymentMethod: paymentMethod === 'creditcard' ? 'creditcard' : 'etransfer',
		paymentConfirmed,
		etransferProvider,
		paymentRecipientEmail,
		paymentPath,
		customer: order.customer,
		shipToDifferentAddress: order.shipToDifferentAddress,
		shippingAddress: order.shippingAddress,
		shippingMethod: order.shippingMethod,
		subtotal: order.subtotal,
		shippingCost: order.shippingCost,
		discountAmount: order.discountAmount,
		promoCode: order.promoCode,
		total: order.total,
		cartItems: order.cartItems.map((item) => ({
			id: item.id,
			name: item.name,
			price: item.price,
			quantity: item.quantity,
		})),
	});

	const adminRecipient = getOrderNotificationRecipient();
	const customerReplyTo = `${order.customer.firstName} ${order.customer.lastName} <${order.customer.email}>`;

	let emailStatus: EmailStatus = { sent: false, skipped: true };
	let adminEmailStatus: EmailStatus = { sent: false, skipped: true };

	if (options.sendCustomerEmail !== false) {
		const emailResult = await sendMail({
			to: order.customer.email,
			from: process.env.ORDER_FROM ?? 'orders@puretide.ca',
			subject: emailData.customer.subject,
			text: emailData.customer.text,
			html: emailData.customer.html,
			replyTo: customerReplyTo,
		});
		emailStatus = emailResult.sent ? { sent: true, skipped: false } : { sent: false, skipped: false, error: emailResult.error };
	}

	if (options.sendAdminEmail !== false) {
		const adminEmailResult = await sendMail({
			to: adminRecipient,
			from: process.env.ORDER_FROM ?? 'orders@puretide.ca',
			subject: emailData.admin.subject,
			text: emailData.admin.text,
			html: emailData.admin.html,
			replyTo: customerReplyTo,
		});
		adminEmailStatus = adminEmailResult.sent ? { sent: true, skipped: false } : { sent: false, skipped: false, error: adminEmailResult.error };
	}

	// Wrike can still receive order tasks, but Zoho is the only product and stock source.
	const stockLevels = await getZohoStockSnapshot(order.cartItems);

	const totalCost = stockLevels.reduce((sum, item) => {
		const cartItem = order.cartItems.find((ci) => ci.name === item.name);
		return sum + item.cost * (cartItem?.quantity ?? 0);
	}, 0);

	const orderForWrike = order as FulfillmentOrder & {
		paymentMethod?: 'etransfer' | 'creditcard';
		paymentPath?: 'manual' | 'bluepeak' | 'manual_friends_family';
		cardFee?: number;
	};
	if (!options.skipOrderTask) {
		await createOrderTask({
			orderNumber: order.orderNumber,
			createdAt: order.createdAt,
			customer: order.customer,
			shipToDifferentAddress: order.shipToDifferentAddress,
			shippingAddress: order.shippingAddress,
			shippingMethod: order.shippingMethod,
			paymentMethod: orderForWrike.paymentMethod ?? 'creditcard',
			paymentPath: orderForWrike.paymentPath,
			paymentRecipientEmail,
			paymentConfirmed,
			cardFee: orderForWrike.cardFee,
			subtotal: order.subtotal,
			shippingCost: order.shippingCost,
			discountAmount: order.discountAmount,
			promoCode: order.promoCode,
			total: order.total,
			cartItems: order.cartItems,
			stockLevels,
			totalCost,
		});
	}

	const clientRecord = {
		email: order.customer.email,
		firstName: order.customer.firstName,
		lastName: order.customer.lastName,
		address: order.customer.address,
		city: order.customer.city,
		province: order.customer.province,
		zipCode: order.customer.zipCode,
		country: order.customer.country,
		orderTotal: order.total,
		lastOrderDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
		productsPurchased: order.cartItems.map((item) => item.name),
		discountAmount: order.discountAmount,
		promoCode: order.promoCode,
	};

	await createClientTask(clientRecord);
	await upsertSheetClient(clientRecord);

	// Final step: update Zoho inventory. Writes remain opt-in outside production so
	// local checkout testing cannot alter live inventory accidentally.
	await decrementZohoStock(order.orderNumber, order.cartItems);

	return { emailStatus, adminEmailStatus };
}
