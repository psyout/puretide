import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { readSheetProducts } from '@/lib/stockSheet';
import { getCachedSheetPromoCodes } from '@/lib/sheetCache';
import type { PromoCode } from '@/types/product';
import { getDiscountedPrice } from '@/lib/pricing';
import { getEffectiveShippingCost, FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import { getPromoMinimumSubtotalError } from '@/lib/promo';
import { listOrdersFromDb, upsertOrderInDb } from '@/lib/ordersDb';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateOrderPostalCodes } from '@/lib/postalValidation';
import { validateCustomer, validateShippingAddress, validateStockAvailability } from '@/lib/orderValidation';
import { getIdempotencyKey, getCachedOrder, setCachedOrder } from '@/lib/idempotency';
import { normalizeCartItemsWithTrustedPrices } from '@/lib/trustedCartPricing';
import { createOrderConfirmationToken } from '@/lib/orderConfirmationToken';
import { buildSafeApiError } from '@/lib/apiError';
import { runFulfillment, type FulfillmentOrder } from '@/lib/orderFulfillment';

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
	shippingMethod: 'express';
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

		let stockError: string | null;
		try {
			stockError = await validateStockAvailability(
				orderPayload.cartItems.map((item) => ({ id: String(item.id), name: item.name, quantity: item.quantity })),
				readSheetProducts,
			);
		} catch (error) {
			return NextResponse.json(
				{
					ok: false,
					error: 'Unable to verify product availability. Please try again later.',
				},
				{ status: 503 },
			);
		}
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
		const destinationZipCode = orderPayload.shipToDifferentAddress ? orderPayload.shippingAddress?.zipCode : orderPayload.customer.zipCode;
		const destinationProvince = orderPayload.shipToDifferentAddress ? orderPayload.shippingAddress?.province : orderPayload.customer.province;
		let shippingCost = getEffectiveShippingCost(destinationZipCode, destinationProvince);

		if (orderPayload.promoCode) {
			const promoCodes = await getCachedSheetPromoCodes();
			const promo = promoCodes.find((p: PromoCode) => p.code === orderPayload.promoCode?.trim().toUpperCase() && p.active);
			if (promo) {
				cartItems = trustedCartItems.map((item) => ({ ...item, price: item.price }));
				const subtotalWithPromo = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
				const minimumError = getPromoMinimumSubtotalError({ promo, subtotal: subtotalWithPromo });
				if (minimumError) {
					return NextResponse.json({ ok: false, error: minimumError }, { status: 400 });
				}
				if (promo.freeShipping) {
					shippingCost = 0;
				}
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
		const normalizedCustomer = {
			...orderPayload.customer,
			email: String(orderPayload.customer.email ?? '').trim(),
		};

		const payload: OrderPayload = {
			...orderPayload,
			customer: normalizedCustomer,
			cartItems: cartItems.map((item) => ({ ...item, id: item.id })),
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
			paymentStatus: 'pending' as const,
			paymentProvider: orderPayload.paymentMethod === 'etransfer' && String(process.env.ENABLE_BLUEPEAK_ETRANSFER ?? '').toLowerCase() === 'true' ? 'bluepeak' : undefined,
			etransfer:
				orderPayload.paymentMethod === 'etransfer'
					? String(process.env.ENABLE_BLUEPEAK_ETRANSFER ?? '').toLowerCase() === 'true'
						? {
								provider: 'bluepeak',
								status: 'awaiting_payment',
								depositEmail: '',
								currency: 'CAD',
								amountExpected: Number(total).toFixed(2),
								amountReceived: '0.00',
								paymentReference: orderNumber,
								paidAt: null,
							}
						: {
								provider: 'manual',
								currency: 'CAD',
								amountExpected: Number(total).toFixed(2),
								amountReceived: '0.00',
								paymentReference: orderNumber,
								paidAt: null,
							}
					: undefined,
			...payload,
		};

		// Save order to DB first so it's always stored even if email fails
		await upsertOrderInDb(orderRecord as Record<string, unknown>);

		// Generate confirmation token and return immediately to avoid request timeouts.
		// Slow downstream side-effects (emails, sheets, Wrike) run asynchronously below.
		if (idemKey) await setCachedOrder(idemKey, orderRecord.orderNumber, orderRecord.id);
		const confirmationToken = createOrderConfirmationToken(orderRecord.orderNumber);
		const response = NextResponse.json({ ok: true, orderId: orderRecord.id, orderNumber: orderRecord.orderNumber, confirmationToken });

		const emailEnabled = String(process.env.ENABLE_EMAIL_NOTIFICATIONS ?? '').toLowerCase() !== 'false';
		const wrikeEnabled = String(process.env.ENABLE_WRIKE_INTEGRATION ?? '').toLowerCase() === 'true';
		const etProvider = (orderRecord as unknown as { etransfer?: { provider?: string } }).etransfer?.provider;
		const shouldRunImmediateEtransferFulfillment = etProvider === 'manual';
		if (orderPayload.paymentMethod === 'etransfer' && shouldRunImmediateEtransferFulfillment && (emailEnabled || wrikeEnabled)) {
			void (async () => {
				try {
					const fulfillmentOrder = {
						...(orderRecord as unknown as Record<string, unknown>),
						paymentMethod: 'etransfer',
						cardFee: orderPayload.cardFee,
					} as unknown as FulfillmentOrder;

					const result = await runFulfillment(fulfillmentOrder);
					await upsertOrderInDb({
						...(orderRecord as unknown as Record<string, unknown>),
						fulfillmentStatus: {
							stockUpdated: true,
							emailsSent: Boolean(result.emailStatus.sent && result.adminEmailStatus.sent),
							clientSynced: false,
						},
						emailStatus: result.emailStatus,
						adminEmailStatus: result.adminEmailStatus,
					});
				} catch (err) {
					console.error('[orders] e-Transfer fulfillment failed', err);
					try {
						await upsertOrderInDb({
							...(orderRecord as unknown as Record<string, unknown>),
							fulfillmentStatus: {
								stockUpdated: false,
								emailsSent: false,
								clientSynced: false,
								failedAt: new Date().toISOString(),
							},
						});
					} catch (persistErr) {
						console.error('[orders] Failed to persist fulfillment failure status', persistErr);
					}
				}
			})();
		}

		// IMPORTANT: For e-transfer orders, fulfillment (emails, stock decrement, Wrike) must only
		// happen after payment is confirmed via webhook. This route only stores the order.
		// Credit card orders are created via /api/digipay/create.

		return response;
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to store order.', error, logLabel: 'orders:post' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
