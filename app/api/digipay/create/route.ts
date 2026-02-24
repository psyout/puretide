import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { readSheetPromoCodes, readSheetProducts } from '@/lib/stockSheet';
import { getDiscountedPrice } from '@/lib/pricing';
import { getEffectiveShippingCost } from '@/lib/constants';
import { buildDigipayPaymentUrl } from '@/lib/digipay';
import { upsertOrderInDb } from '@/lib/ordersDb';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateOrderPostalCodes } from '@/lib/postalValidation';
import { validateCustomer, validateShippingAddress, validateStockAvailability } from '@/lib/orderValidation';
import { getIdempotencyKey, getCachedDigipay, setCachedDigipay } from '@/lib/idempotency';

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

export async function POST(request: Request) {
	const siteId = process.env.DIGIPAY_SITE_ID;
	const encryptionKey = process.env.DIGIPAY_ENCRYPTION_KEY;
	const pburl = process.env.DIGIPAY_POSTBACK_URL;
	const tcompleteBase = process.env.DIGIPAY_TCOMPLETE_BASE;

	if (!siteId || !encryptionKey || !pburl || !tcompleteBase) {
		return NextResponse.json({ ok: false, error: 'DigiPay not configured (missing DIGIPAY_* env vars)' }, { status: 500 });
	}

	const CHECKOUT_RATE_LIMIT = 10;
	const CHECKOUT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

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
			const cached = getCachedDigipay(idemKey);
			if (cached) {
				return NextResponse.json({ ok: true, redirectUrl: cached.redirectUrl, orderNumber: cached.orderNumber });
			}
		}

		const { company: _hp, idempotencyKey: _idem, ...orderPayload } = rawPayload;

		// This route is for credit card only; e-transfer uses POST /api/orders
		if (orderPayload.paymentMethod !== 'creditcard') {
			return NextResponse.json({ ok: false, error: 'Invalid payment method for this endpoint.' }, { status: 400 });
		}

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
		const shippingCost = getEffectiveShippingCost();
		let cartItems: typeof orderPayload.cartItems;
		let discountAmount = 0;

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

		// Safe card fee handling
		const cardFee = orderPayload.paymentMethod === 'creditcard' && Number.isFinite(Number(orderPayload.cardFee)) ? Number(orderPayload.cardFee) : 0;

		const total = Number((subtotal + shippingCost - discountAmount + cardFee).toFixed(2));

		// Reject tampered totals
		if (Math.abs(total - orderPayload.total) > 0.01) {
			return NextResponse.json({ ok: false, error: 'Order total mismatch. Please refresh and try again.' }, { status: 400 });
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

		const orderRecord = {
			id: `order_${timestamp}`,
			orderNumber,
			createdAt,
			paymentStatus: 'pending' as const,
			...payload,
		};

		await upsertOrderInDb(orderRecord as Record<string, unknown>);

		// Build DigiPay redirect (credit card only; e-transfer uses POST /api/orders)
		const useSandbox = process.env.DIGIPAY_USE_SANDBOX === 'true';
		const sandboxSiteId = process.env.DIGIPAY_SANDBOX_SITE_ID;
		const effectiveSiteId = useSandbox && sandboxSiteId ? sandboxSiteId : siteId;

		const tcomplete = `${tcompleteBase.replace(/\/$/, '')}/order-confirmation?orderNumber=${orderNumber}`;

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

		if (idemKey) setCachedDigipay(idemKey, orderNumber, redirectUrl);
		return NextResponse.json({
			ok: true,
			redirectUrl,
			orderNumber,
		});
	} catch (error) {
		console.error('DigiPay create error', error);

		const message = error instanceof Error ? error.message : 'Failed to create payment';

		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
