import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { readSheetProducts } from '@/lib/stockSheet';
import { getCachedSheetPromoCodes } from '@/lib/sheetCache';
import type { PromoCode } from '@/types/product';
import { getDiscountedPrice } from '@/lib/pricing';
import { getEffectiveShippingCost, FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import { buildDigipayPaymentUrl } from '@/lib/digipay';
import { upsertOrderInDb } from '@/lib/ordersDb';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateOrderPostalCodes } from '@/lib/postalValidation';
import { validateCustomer, validateShippingAddress, validateStockAvailability } from '@/lib/orderValidation';
import { getIdempotencyKey, getCachedDigipay, setCachedDigipay } from '@/lib/idempotency';
import { normalizeCartItemsWithTrustedPrices } from '@/lib/trustedCartPricing';
import { createOrderConfirmationToken } from '@/lib/orderConfirmationToken';
import { buildSafeApiError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
		id: number;
		name: string;
		price: number;
		quantity: number;
		image: string;
		description: string;
	}>;
}

const NO_STORE_HEADERS = {
	'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
	Pragma: 'no-cache',
	Expires: '0',
} as const;

function json(body: unknown, init: ResponseInit = {}) {
	const headers = new Headers(init.headers);
	for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
		headers.set(key, value);
	}
	return NextResponse.json(body, { ...init, headers });
}

export async function POST(request: Request) {
	const siteId = process.env.DIGIPAY_SITE_ID;
	const encryptionKey = process.env.DIGIPAY_ENCRYPTION_KEY;
	const pburl = process.env.DIGIPAY_POSTBACK_URL;
	const tcompleteBase = process.env.DIGIPAY_TCOMPLETE_BASE;

	if (!siteId || !encryptionKey || !pburl || !tcompleteBase) {
		return json({ ok: false, error: 'DigiPay not configured (missing DIGIPAY_* env vars)' }, { status: 500 });
	}

	const CHECKOUT_RATE_LIMIT = 10;
	const CHECKOUT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

	try {
		const { allowed } = checkRateLimit(request, 'checkout', CHECKOUT_RATE_LIMIT, CHECKOUT_WINDOW_MS);
		if (!allowed) {
			return json({ ok: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
		}

		const rawPayload = (await request.json()) as OrderPayload & { company?: string; idempotencyKey?: string };
		if (typeof rawPayload.company === 'string' && rawPayload.company.trim() !== '') {
			return json({ ok: false, error: 'Invalid request.' }, { status: 400 });
		}

		const idemKey = getIdempotencyKey(request, rawPayload);
		if (idemKey) {
			const cached = await getCachedDigipay(idemKey);
			if (cached) {
				return json({ ok: true, redirectUrl: cached.redirectUrl, orderNumber: cached.orderNumber });
			}
		}

		const { company: _hp, idempotencyKey: _idem, ...orderPayload } = rawPayload;

		// This route is for credit card only; e-transfer uses POST /api/orders
		if (orderPayload.paymentMethod !== 'creditcard') {
			return json({ ok: false, error: 'Invalid payment method for this endpoint.' }, { status: 400 });
		}
		if (process.env.NEXT_PUBLIC_ENABLE_CREDIT_CARD === 'false') {
			return json({ ok: false, error: 'Credit card payments are temporarily disabled. Please use e-transfer.' }, { status: 503 });
		}

		// Validate cart
		if (!Array.isArray(orderPayload.cartItems) || orderPayload.cartItems.length === 0) {
			return json({ ok: false, error: 'Invalid cart' }, { status: 400 });
		}

		const postalError = validateOrderPostalCodes(orderPayload);
		if (postalError) {
			return json({ ok: false, error: postalError }, { status: 400 });
		}
		if (orderPayload.shipToDifferentAddress) {
			const shippingError = validateShippingAddress(orderPayload.shippingAddress);
			if (shippingError) {
				return json({ ok: false, error: shippingError }, { status: 400 });
			}
		}

		const customerError = validateCustomer(orderPayload.customer);
		if (customerError) {
			return json({ ok: false, error: customerError }, { status: 400 });
		}

		const stockError = await validateStockAvailability(orderPayload.cartItems, readSheetProducts);
		if (stockError) {
			return json({ ok: false, error: stockError }, { status: 400 });
		}
		const products = await readSheetProducts();
		const trustedCart = normalizeCartItemsWithTrustedPrices(orderPayload.cartItems, products);
		if (!trustedCart.ok) {
			return json({ ok: false, error: trustedCart.error }, { status: 400 });
		}
		const trustedCartItems = trustedCart.items;

		// Promo and volume discount cannot stack: if valid promo, use raw prices; else apply volume discount
		let shippingCost = getEffectiveShippingCost(orderPayload.customer.zipCode);
		let cartItems: typeof orderPayload.cartItems;
		let discountAmount = 0;

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

		// Apply free shipping if subtotal after discounts exceeds threshold
		const subtotalAfterDiscounts = subtotal - discountAmount;
		if (subtotalAfterDiscounts > FREE_SHIPPING_THRESHOLD) {
			shippingCost = 0;
		}

		// Safe card fee handling
		const cardFee = orderPayload.paymentMethod === 'creditcard' && Number.isFinite(Number(orderPayload.cardFee)) ? Number(orderPayload.cardFee) : 0;

		const total = Number((subtotal + shippingCost - discountAmount + cardFee).toFixed(2));

		// Reject tampered totals
		if (Math.abs(total - orderPayload.total) > 0.01) {
			return json({ ok: false, error: 'Order total mismatch. Please refresh and try again.' }, { status: 400 });
		}

		const payload: OrderPayload = {
			...orderPayload,
			cartItems,
			subtotal,
			shippingCost,
			discountAmount,
			cardFee,
			total,
		};

		const timestamp = Date.now();
		const orderNumber = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
		const createdAt = new Date().toISOString();

		// Build DigiPay redirect (credit card only; e-transfer uses POST /api/orders)
		const useSandbox = process.env.DIGIPAY_USE_SANDBOX === 'true';
		const sandboxSiteId = process.env.DIGIPAY_SANDBOX_SITE_ID;
		const effectiveSiteId = useSandbox && sandboxSiteId ? sandboxSiteId : siteId;
		const confirmationToken = createOrderConfirmationToken(orderNumber);
		const confirmationParams = new URLSearchParams({ orderNumber });
		if (confirmationToken) {
			confirmationParams.set('token', confirmationToken);
		}

		const tcomplete = `${tcompleteBase.replace(/\/$/, '')}/order-confirmation?${confirmationParams.toString()}`;

		const orderRecord = {
			id: `order_${timestamp}`,
			orderNumber,
			createdAt,
			paymentStatus: 'pending' as const,
			paymentProvider: 'digipay',
			digipay: {
				useSandbox,
				siteId: effectiveSiteId,
				pburl,
				tcomplete,
			},
			...payload,
		};

		await upsertOrderInDb(orderRecord as Record<string, unknown>);

		const redirectUrl = buildDigipayPaymentUrl(
			{
				siteId: effectiveSiteId,
				chargeAmount: total.toFixed(2),
				orderDescription: `Order #${orderNumber}`,
				session: orderNumber,
				pburl,
				tcomplete,
				shipped: true,
				firstName: payload.customer.firstName,
				lastName: payload.customer.lastName,
				email: payload.customer.email.trim().toLowerCase(),
				address: payload.customer.address,
				city: payload.customer.city,
				state: payload.customer.province,
				zip: payload.customer.zipCode,
				country: payload.customer.country,
			},
			encryptionKey,
		);

		console.log(
			JSON.stringify({
				label: 'digipay:create',
				orderNumber,
				total,
				useSandbox,
				effectiveSiteId,
				pburl,
				tcomplete,
			}),
		);

		if (idemKey) await setCachedDigipay(idemKey, orderNumber, redirectUrl);
		return json({
			ok: true,
			redirectUrl,
			orderNumber,
		});
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to create payment.', error, logLabel: 'digipay:create' });
		console.error(JSON.stringify({ label: 'digipay:create:error', errorId: safe.errorId }));
		return json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
