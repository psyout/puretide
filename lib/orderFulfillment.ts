import { buildOrderEmails } from '@/lib/orderEmail';
import { sendLowStockAlert, sendMail } from '@/lib/email';
import { LOW_STOCK_THRESHOLD, DEFAULT_ORDER_NOTIFICATION_EMAIL } from '@/lib/constants';
import { createOrderTask, createClientTask } from '@/lib/wrike';
import { decrementStock, getProductInventory, getProductsBelowReorderPoint } from '@/lib/wrikeProducts';
import { readSheetProducts, writeSheetProducts } from '@/lib/stockSheet';

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
			const before = await getProductInventory(String(item.id));
			console.log(
				JSON.stringify({
					label: 'fulfillment:wrike:item_start',
					productId: String(item.id),
					name: item.name,
					quantity: item.quantity,
					beforeStock: before?.stock ?? null,
					beforeCost: before?.cost ?? null,
					beforeWrikeTaskId: before?.wrikeTaskId ?? null,
				}),
			);
			const success = await decrementStock(String(item.id), item.quantity);
			if (success) {
				const inventory = await getProductInventory(String(item.id));
				console.log(
					JSON.stringify({
						label: 'fulfillment:wrike:item_success',
						productId: String(item.id),
						name: item.name,
						quantity: item.quantity,
						afterStock: inventory?.stock ?? null,
						afterCost: inventory?.cost ?? null,
						afterWrikeTaskId: inventory?.wrikeTaskId ?? null,
					}),
				);
				stockLevels.push({
					name: item.name,
					stock: inventory?.stock ?? 0,
					cost: inventory?.cost ?? 0,
				});
			} else {
				const after = await getProductInventory(String(item.id));
				console.warn(
					JSON.stringify({
						label: 'fulfillment:wrike:item_failed',
						productId: String(item.id),
						name: item.name,
						quantity: item.quantity,
						beforeStock: before?.stock ?? null,
						afterStock: after?.stock ?? null,
						afterWrikeTaskId: after?.wrikeTaskId ?? null,
					}),
				);
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

async function decrementGoogleSheetStock(orderNumber: string, items: FulfillmentOrder['cartItems']) {
	const enabled = String(process.env.ENABLE_SHEET_SYNC ?? '').toLowerCase() !== 'false';
	if (!enabled) {
		console.warn(JSON.stringify({ label: 'fulfillment:sheets:skipped', orderNumber, reason: 'ENABLE_SHEET_SYNC=false' }));
		return;
	}

	console.log(JSON.stringify({ label: 'fulfillment:sheets:start', orderNumber, items: items.map((i) => ({ id: i.id, qty: i.quantity })) }));

	const products = await readSheetProducts();
	const byId = new Map(products.map((p) => [p.id, p] as const));

	for (const item of items) {
		const product = byId.get(String(item.id));
		if (!product) {
			console.error(
				JSON.stringify({
					label: 'fulfillment:sheets:product_not_found',
					orderNumber,
					productId: String(item.id),
					name: item.name,
					quantity: item.quantity,
				}),
			);
			throw new Error(`Product not found in Google Sheet: ${String(item.id)}`);
		}

		const prev = Number(product.stock ?? 0);
		const qty = Number(item.quantity ?? 0);
		const next = Math.max(0, prev - qty);
		product.stock = next;

		console.log(
			JSON.stringify({
				label: 'fulfillment:sheets:deduct',
				orderNumber,
				productId: product.id,
				name: product.name,
				quantity: qty,
				prevStock: prev,
				newStock: next,
			}),
		);
	}

	await writeSheetProducts(products);
	console.log(JSON.stringify({ label: 'fulfillment:sheets:success', orderNumber }));
}

export async function runFulfillment(order: FulfillmentOrder): Promise<RunFulfillmentResult> {
	console.log(JSON.stringify({ label: 'fulfillment:start', orderNumber: order.orderNumber }));
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

	// Final step: update Google Sheets stock (source of truth)
	await decrementGoogleSheetStock(order.orderNumber, order.cartItems);

	return { emailStatus, adminEmailStatus };
}
