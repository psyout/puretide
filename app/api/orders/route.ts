import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildOrderEmails } from '@/lib/orderEmail';
import nodemailer from 'nodemailer';
import { readSheetProducts, writeSheetProducts, readSheetPromoCodes, upsertSheetClient } from '@/lib/stockSheet';
import { getDiscountedPrice } from '@/lib/pricing';
import { sendLowStockAlert } from '@/lib/email';
import { LOW_STOCK_THRESHOLD, getEffectiveShippingCost, DEFAULT_ORDER_NOTIFICATION_EMAIL } from '@/lib/constants';
import { createOrderTask, createStockAlertTask } from '@/lib/wrike';
import { listOrdersFromDb, upsertOrderInDb } from '@/lib/ordersDb';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateOrderPostalCodes } from '@/lib/postalValidation';
import { validateCustomer, validateShippingAddress, validateStockAvailability } from '@/lib/orderValidation';
import { getIdempotencyKey, getCachedOrder, setCachedOrder } from '@/lib/idempotency';

interface OrderPayload {
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
	paymentMethod: 'etransfer' | 'creditcard';
	cardFee?: number;
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
}

function requireOrdersApiKey(request: Request): boolean {
	const key = process.env.ORDERS_API_KEY;
	if (!key) return false;
	const provided = request.headers.get('x-api-key') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
	return provided === key;
}

export async function GET(request: Request) {
	try {
		if (!requireOrdersApiKey(request)) {
			return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
		}
		const orders = await listOrdersFromDb();
		const sorted = [...orders].sort((a, b) => {
			const aT = String(a.createdAt ?? '');
			const bT = String(b.createdAt ?? '');
			return bT.localeCompare(aT);
		});
		return NextResponse.json({ ok: true, orders: sorted });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to read orders';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}

type EmailStatus = {
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

async function sendOrderEmail(to: string, subject: string, text: string, html: string, replyTo?: string, bccOverride?: string, fromOverride?: string): Promise<EmailStatus> {
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

const formatOrderFrom = (value: string, label = 'Puretide Order Confirmation') => {
	const match = value.match(/<([^>]+)>/);
	const address = match ? match[1] : value;
	return `${label} <${address}>`;
};

async function updateSheetStock(items: OrderPayload['cartItems']): Promise<Array<{ name: string; stock: number }>> {
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

		// Create Wrike task for low stock items
		if (lowStock.length > 0) {
			await createStockAlertTask(lowStock);
		}

		// Return stock levels for ordered items
		const orderedItemsStock = items.map((item) => {
			const product = updated.find((p) => p.id === String(item.id) || p.slug === String(item.id));
			return { name: item.name, stock: product?.stock ?? 0 };
		});

		return orderedItemsStock;
	} catch (error) {
		console.error('Failed to update stock sheet', error);
		return [];
	}
}

const CHECKOUT_RATE_LIMIT = 10;
const CHECKOUT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
	try {
		const { allowed } = checkRateLimit(request, 'checkout', CHECKOUT_RATE_LIMIT, CHECKOUT_WINDOW_MS);
		if (!allowed) {
			return NextResponse.json({ ok: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
		}

		const rawPayload = (await request.json()) as OrderPayload & { company?: string; idempotencyKey?: string };
		if (typeof rawPayload.company === 'string' && rawPayload.company.trim() !== '') {
			return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
		}

		const idemKey = getIdempotencyKey(request, rawPayload);
		if (idemKey) {
			const cached = getCachedOrder(idemKey);
			if (cached) {
				return NextResponse.json({ ok: true, orderId: cached.orderId, orderNumber: cached.orderNumber });
			}
		}

		const { company: _hp, idempotencyKey: _idem, ...orderPayload } = rawPayload;

		// Validate cart
		if (!Array.isArray(orderPayload.cartItems) || orderPayload.cartItems.length === 0) {
			return NextResponse.json({ ok: false, error: 'Invalid cart' }, { status: 400 });
		}

		const postalError = validateOrderPostalCodes(orderPayload);
		if (postalError) {
			return NextResponse.json({ ok: false, error: postalError }, { status: 400 });
		}
		if (orderPayload.shipToDifferentAddress) {
			const shippingError = validateShippingAddress(orderPayload.shippingAddress);
			if (shippingError) {
				return NextResponse.json({ ok: false, error: shippingError }, { status: 400 });
			}
		}

		const customerError = validateCustomer(orderPayload.customer);
		if (customerError) {
			return NextResponse.json({ ok: false, error: customerError }, { status: 400 });
		}

		const stockError = await validateStockAvailability(orderPayload.cartItems, readSheetProducts);
		if (stockError) {
			return NextResponse.json({ ok: false, error: stockError }, { status: 400 });
		}

		// Promo and volume discount cannot stack: if valid promo, use raw prices; else apply volume discount
		let cartItems: typeof orderPayload.cartItems;
		let discountAmount = 0;
		const shippingCost = getEffectiveShippingCost();

		if (orderPayload.promoCode) {
			const promoCodes = await readSheetPromoCodes();
			const promo = promoCodes.find((p) => p.code === orderPayload.promoCode?.trim().toUpperCase() && p.active);
			if (promo) {
				cartItems = orderPayload.cartItems.map((item) => ({ ...item, price: item.price }));
				const subtotalWithPromo = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
				discountAmount = Number((subtotalWithPromo * (promo.discount / 100)).toFixed(2));
			} else {
				cartItems = orderPayload.cartItems.map((item) => ({
					...item,
					price: getDiscountedPrice(item.price, item.quantity),
				}));
			}
		} else {
			cartItems = orderPayload.cartItems.map((item) => ({
				...item,
				price: getDiscountedPrice(item.price, item.quantity),
			}));
		}

		const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

		const total = Number((subtotal + shippingCost - discountAmount).toFixed(2));

		const payload: OrderPayload = {
			...orderPayload,
			cartItems,
			subtotal,
			shippingCost,
			discountAmount,
			total,
		};

		const orderNumber = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
		const createdAt = new Date().toISOString();
		const orderRecord = {
			id: `order_${orderNumber}`,
			orderNumber,
			createdAt,
			paymentStatus: 'paid' as const,
			...payload,
		};

		// Save order to DB first so it's always stored even if email fails
		await upsertOrderInDb(orderRecord as Record<string, unknown>);

		const emailData = buildOrderEmails({
			...payload,
			orderNumber,
			createdAt,
		});

		const adminRecipient = getOrderNotificationRecipient();
		const customerEmail = payload.customer.email;
		const customerReplyTo = `${payload.customer.firstName} ${payload.customer.lastName} <${customerEmail}>`;
		const smtpConfig = getSmtpConfigLocal();
		const orderFrom = smtpConfig ? formatOrderFrom(smtpConfig.from) : undefined;
		const emailStatus = await sendOrderEmail(customerEmail, emailData.customer.subject, emailData.customer.text, emailData.customer.html, undefined, '', orderFrom);
		const adminEmailStatus = await sendOrderEmail(adminRecipient, emailData.admin.subject, emailData.admin.text, emailData.admin.html, customerReplyTo, '', orderFrom);

		if (!emailStatus.sent) {
			console.warn(`[Orders] Order ${orderNumber} customer email not sent: ${emailStatus.skipped ? 'SMTP not configured' : emailStatus.error ?? 'unknown'}`);
		}
		if (!adminEmailStatus.sent) {
			console.warn(`[Orders] Order ${orderNumber} admin email not sent: ${adminEmailStatus.skipped ? 'SMTP not configured' : adminEmailStatus.error ?? 'unknown'}`);
		}

		// Update order with email preview and status (order already saved above)
		await upsertOrderInDb({
			...orderRecord,
			emailPreview: {
				subject: emailData.customer.subject,
				text: emailData.customer.text,
			},
			adminEmailPreview: {
				subject: emailData.admin.subject,
				text: emailData.admin.text,
			},
			emailStatus,
			adminEmailStatus,
		} as Record<string, unknown>);
		const updatedStock = await updateSheetStock(payload.cartItems);

		// Create Wrike task for the order
		// await createOrderTask({
		//	orderNumber,
		//	createdAt,
		//	customer: payload.customer,
		//	shipToDifferentAddress: payload.shipToDifferentAddress,
		//	shippingAddress: payload.shippingAddress,
		//	shippingMethod: payload.shippingMethod,
		//	paymentMethod: payload.paymentMethod,
		//	cardFee: payload.cardFee,
		//	subtotal: payload.subtotal,
		//	shippingCost: payload.shippingCost,
		//	discountAmount: payload.discountAmount,
		//	promoCode: payload.promoCode,
		//	total: payload.total,
		//	cartItems: payload.cartItems,
		//	stockLevels: updatedStock,
		//});

		// Save client to Google Sheets for marketing
		await upsertSheetClient({
			email: payload.customer.email,
			firstName: payload.customer.firstName,
			lastName: payload.customer.lastName,
			address: payload.customer.address,
			city: payload.customer.city,
			province: payload.customer.province,
			zipCode: payload.customer.zipCode,
			country: payload.customer.country,
			orderTotal: payload.total,
			lastOrderDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
			productsPurchased: payload.cartItems.map((item) => item.name),
		});

		if (idemKey) setCachedOrder(idemKey, orderRecord.orderNumber, orderRecord.id);
		return NextResponse.json({ ok: true, orderId: orderRecord.id, orderNumber: orderRecord.orderNumber });
	} catch (error) {
		console.error('Failed to store order', error);
		const message = error instanceof Error ? error.message : 'Failed to store order';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
