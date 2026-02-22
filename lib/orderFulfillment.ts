import nodemailer from 'nodemailer';
import { buildOrderEmails } from '@/lib/orderEmail';
import { readSheetProducts, writeSheetProducts } from '@/lib/stockSheet';
import { sendLowStockAlert } from '@/lib/email';
import { LOW_STOCK_THRESHOLD, DEFAULT_ORDER_NOTIFICATION_EMAIL } from '@/lib/constants';
import { createStockAlertTask } from '@/lib/wrike';

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
		id: number;
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

function getSmtpConfigLocal() {
	const host = process.env.ORDER_SMTP_HOST ?? process.env.SMTP_HOST;
	const port = process.env.ORDER_SMTP_PORT ? Number(process.env.ORDER_SMTP_PORT) : process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
	const user = process.env.ORDER_SMTP_USER ?? process.env.SMTP_USER;
	const pass = process.env.ORDER_SMTP_PASS ?? process.env.SMTP_PASS;
	const from = process.env.ORDER_FROM ?? process.env.SMTP_FROM;
	const replyTo = process.env.SMTP_REPLY_TO;
	const bcc = process.env.SMTP_BCC;
	const secure = process.env.ORDER_SMTP_SECURE === 'true' || (process.env.ORDER_SMTP_SECURE == null && process.env.SMTP_SECURE === 'true');

	if (!host || !port || !user || !pass || !from) {
		return null;
	}

	return { host, port, user, pass, from, replyTo, bcc, secure };
}

function getOrderNotificationRecipient() {
	return process.env.ORDER_NOTIFICATION_EMAIL ?? DEFAULT_ORDER_NOTIFICATION_EMAIL;
}

const formatOrderFrom = (value: string, label = 'Puretide Order Confirmation') => {
	const match = value.match(/<([^>]+)>/);
	const address = match ? match[1] : value;
	return `${label} <${address}>`;
};

async function sendOrderEmail(
	to: string,
	subject: string,
	text: string,
	html: string,
	replyTo?: string,
	bccOverride?: string,
	fromOverride?: string
): Promise<EmailStatus> {
	const smtpConfig = getSmtpConfigLocal();
	if (!smtpConfig) {
		return { sent: false, skipped: true, error: 'SMTP not configured' };
	}

	const from = fromOverride ?? smtpConfig.from;
	const transporter = nodemailer.createTransport({
		host: smtpConfig.host,
		port: smtpConfig.port,
		secure: smtpConfig.secure,
		auth: {
			user: smtpConfig.user,
			pass: smtpConfig.pass,
		},
	});

	try {
		await transporter.sendMail({
			from,
			to,
			subject,
			text,
			html,
			replyTo: replyTo ?? smtpConfig.replyTo ?? smtpConfig.from,
			bcc: bccOverride ?? smtpConfig.bcc,
		});
		return { sent: true, skipped: false };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown email error';
		return { sent: false, skipped: false, error: message };
	}
}

export async function updateSheetStock(
	items: FulfillmentOrder['cartItems']
): Promise<Array<{ name: string; stock: number }>> {
	try {
		const current = await readSheetProducts();
		const updated = current.map((product) => {
			const match = items.find((item) => String(item.id) === product.id || String(item.id) === product.slug);
			if (!match) {
				return product;
			}
			const nextStock = Math.max(0, product.stock - match.quantity);
			return { ...product, stock: nextStock };
		});

		const lowStock = updated.filter((product) => product.stock <= LOW_STOCK_THRESHOLD);

		await writeSheetProducts(updated);
		await sendLowStockAlert(lowStock);

		if (lowStock.length > 0) {
			await createStockAlertTask(lowStock);
		}

		const orderedItemsStock = items.map((item) => {
			const product = updated.find((p) => p.id === String(item.id) || p.slug === String(item.id));
			return { name: item.name, stock: product?.stock ?? 0 };
		});

		return orderedItemsStock;
	} catch (error) {
		console.error('[orderFulfillment] Failed to update stock sheet', error);
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
	const smtpConfig = getSmtpConfigLocal();
	const orderFrom = smtpConfig ? formatOrderFrom(smtpConfig.from) : undefined;

	const emailStatus = await sendOrderEmail(
		order.customer.email,
		emailData.customer.subject,
		emailData.customer.text,
		emailData.customer.html,
		undefined,
		'',
		orderFrom
	);
	const adminEmailStatus = await sendOrderEmail(
		adminRecipient,
		emailData.admin.subject,
		emailData.admin.text,
		emailData.admin.html,
		customerReplyTo,
		'',
		orderFrom
	);

	await updateSheetStock(order.cartItems);

	return { emailStatus, adminEmailStatus };
}
