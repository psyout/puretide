import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildOrderEmails } from '@/lib/orderEmail';
import { sendMail } from '@/lib/email';
import { readSheetProducts, writeSheetProducts, upsertSheetClient } from '@/lib/stockSheet';
import { getCachedSheetPromoCodes, getCachedSheetClients } from '@/lib/sheetCache';
import type { PromoCode } from '@/types/product';
import { getDiscountedPrice } from '@/lib/pricing';
import { sendLowStockAlert } from '@/lib/email';
import { LOW_STOCK_THRESHOLD, getEffectiveShippingCost, DEFAULT_ORDER_NOTIFICATION_EMAIL, FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import { createOrderTask, createClientTask } from '@/lib/wrike';
import { updateProductStock } from '@/lib/wrikeProducts';
import { listOrdersFromDb, upsertOrderInDb } from '@/lib/ordersDb';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateOrderPostalCodes } from '@/lib/postalValidation';
import { validateCustomer, validateShippingAddress, validateStockAvailability } from '@/lib/orderValidation';
import { getIdempotencyKey, getCachedOrder, setCachedOrder } from '@/lib/idempotency';
import { normalizeCartItemsWithTrustedPrices } from '@/lib/trustedCartPricing';
import { validateEnv } from '@/lib/env';
import { createOrderConfirmationToken } from '@/lib/orderConfirmationToken';
import { buildSafeApiError } from '@/lib/apiError';

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
		id: number | string;
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
	const provided =
		request.headers.get('x-api-key') ??
		request.headers
			.get('authorization')
			?.replace(/^Bearer\s+/i, '')
			.trim();
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
		const safe = buildSafeApiError({ defaultMessage: 'Failed to read orders.', error, logLabel: 'orders:get' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}

type EmailStatus = {
	sent: boolean;
	skipped: boolean;
	error?: string;
};

function getOrderNotificationRecipient() {
	return process.env.ORDER_NOTIFICATION_EMAIL ?? DEFAULT_ORDER_NOTIFICATION_EMAIL;
}

async function updateSheetStock(items: OrderPayload['cartItems']): Promise<Array<{ id: string; name: string; stock: number }>> {
	try {
		const current = await readSheetProducts();
		const updated = current.map((product) => {
			// Check if any item matches this product (either base ID or variant ID)
			const match = items.find((item) => {
				const itemId = String(item.id);
				// Check for direct match (base product)
				if (itemId === product.id || itemId === product.slug) {
					return true;
				}
				// Check for variant match (e.g., "MOTS-C-40" matches product "MOTS-C")
				if (itemId.includes('-')) {
					const baseId = itemId.split('-')[0];
					return baseId === product.id || baseId === product.slug;
				}
				return false;
			});

			if (!match) {
				return product;
			}

			// Check if this is a variant item
			const itemId = String(match.id);
			const isVariant = itemId.includes('-');

			if (isVariant) {
				// Extract variant mg from ID (e.g., "40" from "MOTS-C-40")
				const variantMg = itemId.split('-')[1];
				// Determine which variant stock column to decrement
				if (String(product.mg_1) === variantMg) {
					const nextStock = Math.max(0, (product.stock_1 || 0) - match.quantity);
					return { ...product, stock_1: nextStock };
				} else if (String(product.mg_2) === variantMg) {
					const nextStock = Math.max(0, (product.stock_2 || 0) - match.quantity);
					return { ...product, stock_2: nextStock };
				}
				// Fallback: decrement base stock if variant not found
				const nextStock = Math.max(0, product.stock - match.quantity);
				return { ...product, stock: nextStock };
			} else {
				// Regular product: decrement base stock
				const nextStock = Math.max(0, product.stock - match.quantity);
				return { ...product, stock: nextStock };
			}
		});

		const lowStock = updated.filter((product) => product.stock <= LOW_STOCK_THRESHOLD);

		await writeSheetProducts(updated);
		await sendLowStockAlert(lowStock);

		// Return stock levels for ordered items
		const orderedItemsStock = items.map((item) => {
			const itemId = String(item.id);
			const isVariant = itemId.includes('-');
			let stock = 0;

			if (isVariant) {
				const baseId = itemId.split('-')[0];
				const variantMg = itemId.split('-')[1];
				const product = updated.find((p) => p.id === baseId || p.slug === baseId);
				if (product) {
					if (String(product.mg_1) === variantMg) {
						stock = product.stock_1 || 0;
					} else if (String(product.mg_2) === variantMg) {
						stock = product.stock_2 || 0;
					} else {
						stock = product.stock || 0;
					}
				}
			} else {
				const product = updated.find((p) => p.id === itemId || p.slug === itemId);
				stock = product?.stock ?? 0;
			}

			return { id: itemId, name: item.name, stock };
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
			const cached = await getCachedOrder(idemKey);
			if (cached) {
				const token = createOrderConfirmationToken(cached.orderNumber);
				return NextResponse.json({
					ok: true,
					orderNumber: cached.orderNumber,
					orderId: cached.orderId,
					token,
				});
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

		const stockError = await validateStockAvailability(
			orderPayload.cartItems.map((item) => ({ id: String(item.id), name: item.name, quantity: item.quantity })),
			readSheetProducts,
		);
		if (stockError) {
			return NextResponse.json({ ok: false, error: stockError }, { status: 400 });
		}

		// Validate credit card limit
		if (orderPayload.paymentMethod === 'creditcard' && orderPayload.total > 500) {
			return NextResponse.json(
				{
					ok: false,
					error: 'Credit card payments are limited to $500 per transaction. Please select another payment method.',
				},
				{ status: 400 },
			);
		}
		const products = await readSheetProducts();
		const trustedCart = normalizeCartItemsWithTrustedPrices(orderPayload.cartItems, products);
		if (!trustedCart.ok) {
			return NextResponse.json({ ok: false, error: trustedCart.error }, { status: 400 });
		}
		const trustedCartItems = trustedCart.items;

		// Promo and volume discount cannot stack: if valid promo, use raw prices; else apply volume discount
		let cartItems: Array<{ id: number | string; name: string; price: number; quantity: number; image: string; description: string }>;
		let discountAmount = 0;
		let shippingCost = getEffectiveShippingCost(orderPayload.customer.zipCode);

		if (orderPayload.promoCode) {
			const promoCodes = await getCachedSheetPromoCodes();
			const promo = promoCodes.find((p: PromoCode) => p.code === orderPayload.promoCode?.trim().toUpperCase() && p.active);
			if (promo) {
				if (promo.freeShipping) {
					shippingCost = 0;
				}
				cartItems = trustedCartItems.map((item) => ({ ...item, price: item.price }));
				const subtotalWithPromo = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
				discountAmount = Number((subtotalWithPromo * (promo.discount / 100)).toFixed(2));
			} else {
				cartItems = trustedCartItems.map((item) => ({
					...item,
					price: getDiscountedPrice(item.price, item.quantity),
				}));
			}
		} else {
			cartItems = trustedCartItems.map((item) => ({
				...item,
				price: getDiscountedPrice(item.price, item.quantity),
			}));
		}

		const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

		const subtotalAfterDiscounts = subtotal - discountAmount;
		if (subtotalAfterDiscounts > FREE_SHIPPING_THRESHOLD) {
			shippingCost = 0;
		}

		const total = Number((subtotal + shippingCost - discountAmount).toFixed(2));

		const payload: OrderPayload = {
			...orderPayload,
			cartItems: cartItems.map((item) => ({ ...item, id: Number(item.id) })),
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

		// Generate confirmation token and return immediately to avoid request timeouts.
		// Slow downstream side-effects (emails, sheets, Wrike) run asynchronously below.
		if (idemKey) await setCachedOrder(idemKey, orderRecord.orderNumber, orderRecord.id);
		const confirmationToken = createOrderConfirmationToken(orderRecord.orderNumber);
		const response = NextResponse.json({ ok: true, orderId: orderRecord.id, orderNumber: orderRecord.orderNumber, confirmationToken });

		const emailData = buildOrderEmails({
			...payload,
			orderNumber,
			createdAt,
		});

		const adminRecipient = getOrderNotificationRecipient();
		const customerEmail = payload.customer.email;
		const customerReplyTo = `${payload.customer.firstName} ${payload.customer.lastName} <${customerEmail}>`;

		void (async () => {
			try {
				const emailResult = await sendMail({
					to: customerEmail,
					from: process.env.ORDER_FROM ?? 'orders@puretide.ca',
					subject: emailData.customer.subject,
					text: emailData.customer.text,
					html: emailData.customer.html,
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

				if (!emailStatus.sent) {
					console.warn(`[Orders] Order ${orderNumber} customer email not sent: ${emailStatus.error ?? 'unknown'}`);
				}
				if (!adminEmailStatus.sent) {
					console.warn(`[Orders] Order ${orderNumber} admin email not sent: ${adminEmailStatus.error ?? 'unknown'}`);
				}

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
			} catch (error) {
				console.error('[Orders] Failed to send emails / update email status', error);
			}

			let updatedStock: Array<{ id: string; name: string; stock: number }> = [];
			try {
				updatedStock = await updateSheetStock(payload.cartItems);
			} catch (error) {
				console.error('[Orders] Failed to update stock sheet', error);
			}

			try {
				for (const s of updatedStock) {
					await updateProductStock(s.id, s.stock);
				}
			} catch (error) {
				console.error('[Orders] Failed to sync stock to Wrike products', error);
			}

			try {
				await createOrderTask({
					orderNumber,
					createdAt,
					customer: payload.customer,
					shipToDifferentAddress: payload.shipToDifferentAddress,
					shippingAddress: payload.shippingAddress,
					shippingMethod: payload.shippingMethod,
					paymentMethod: payload.paymentMethod,
					cardFee: payload.cardFee,
					subtotal: payload.subtotal,
					shippingCost: payload.shippingCost,
					discountAmount: payload.discountAmount,
					promoCode: payload.promoCode,
					total: payload.total,
					cartItems: payload.cartItems,
					stockLevels: updatedStock.map((s) => ({ name: s.name, stock: s.stock })),
				});
			} catch (error) {
				console.error('[Orders] Failed to create Wrike order task', error);
			}

			try {
				const clientPayload = {
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
				};
				await upsertSheetClient(clientPayload);
				await createClientTask(clientPayload);
			} catch (error) {
				console.error('[Orders] Failed to upsert client / create client task', error);
			}
		})();

		return response;
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to store order.', error, logLabel: 'orders:post' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
