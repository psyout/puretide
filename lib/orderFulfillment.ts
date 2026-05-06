import { buildOrderEmails } from '@/lib/orderEmail';
import { sendLowStockAlert, sendMail } from '@/lib/email';
import { LOW_STOCK_THRESHOLD, DEFAULT_ORDER_NOTIFICATION_EMAIL } from '@/lib/constants';
import { createOrderTask, createClientTask } from '@/lib/wrike';
import { decrementStock, getProductInventory, getProductsBelowReorderPoint } from '@/lib/wrikeProducts';

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
	shippingMethod: 'regular' | 'express';
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
	return process.env.ORDER_NOTIFICATION_EMAIL ?? DEFAULT_ORDER_NOTIFICATION_EMAIL;
}

export async function updateWrikeStock(items: FulfillmentOrder['cartItems']): Promise<Array<{ name: string; stock: number; cost: number }>> {
	try {
		const stockLevels: Array<{ name: string; stock: number; cost: number }> = [];

		for (const item of items) {
			const success = await decrementStock(String(item.id), item.quantity);
			if (success) {
				const inventory = await getProductInventory(String(item.id));
				stockLevels.push({
					name: item.name,
					stock: inventory?.stock ?? 0,
					cost: inventory?.cost ?? 0,
				});
			} else {
				console.warn('[orderFulfillment] Failed to decrement stock for:', item.id);
				stockLevels.push({ name: item.name, stock: 0, cost: 0 });
			}
		}

		const lowStockProducts = await getProductsBelowReorderPoint();
		if (lowStockProducts.length > 0) {
			const lowStockForAlert = lowStockProducts.map((inv) => ({
				name: inv.productId,
				slug: inv.productId,
				stock: inv.stock,
			}));
			await sendLowStockAlert(lowStockForAlert);
		}

		return stockLevels;
	} catch (error) {
		console.error('[orderFulfillment] Failed to update Wrike stock', error);
		return [];
	}
}

export type RunFulfillmentResult = {
	emailStatus: EmailStatus;
	adminEmailStatus: EmailStatus;
};

export async function runFulfillment(order: FulfillmentOrder): Promise<RunFulfillmentResult> {
	const paymentMethod = (order as Record<string, unknown>).paymentMethod as 'etransfer' | 'creditcard' | undefined;
	const emailData = buildOrderEmails({
		orderNumber: order.orderNumber,
		createdAt: order.createdAt,
		paymentMethod: paymentMethod === 'creditcard' ? 'creditcard' : 'etransfer',
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

	const emailResult = await sendMail({
		to: order.customer.email,
		from: process.env.ORDER_FROM ?? 'orders@puretide.ca',
		subject: emailData.customer.subject,
		text: emailData.customer.text,
		html: emailData.customer.html,
		replyTo: customerReplyTo,
	});

	const adminEmailResult = await sendMail({
		to: adminRecipient,
		from: process.env.ORDER_FROM ?? 'orders@puretide.ca',
		subject: emailData.admin.subject,
		text: emailData.admin.text,
		html: emailData.admin.html,
		replyTo: customerReplyTo,
	});

	const emailStatus: EmailStatus = emailResult.sent ? { sent: true, skipped: false } : { sent: false, skipped: false, error: emailResult.error };

	const adminEmailStatus: EmailStatus = adminEmailResult.sent ? { sent: true, skipped: false } : { sent: false, skipped: false, error: adminEmailResult.error };

	const stockLevels = await updateWrikeStock(order.cartItems);

	const totalCost = stockLevels.reduce((sum, item) => {
		const cartItem = order.cartItems.find((ci) => ci.name === item.name);
		return sum + item.cost * (cartItem?.quantity ?? 0);
	}, 0);

	const orderForWrike = order as FulfillmentOrder & { paymentMethod?: 'etransfer' | 'creditcard'; cardFee?: number };
	await createOrderTask({
		orderNumber: order.orderNumber,
		createdAt: order.createdAt,
		customer: order.customer,
		shipToDifferentAddress: order.shipToDifferentAddress,
		shippingAddress: order.shippingAddress,
		shippingMethod: order.shippingMethod,
		paymentMethod: orderForWrike.paymentMethod ?? 'creditcard',
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

	await createClientTask({
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
	});

	return { emailStatus, adminEmailStatus };
}
