import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { isIP } from 'net';
import { readProducts } from '@/lib/productCatalog';
import { readSheetPromoCodes } from '@/lib/stockSheet';
import { getEffectiveShippingCost } from '@/lib/constants';
import { getOrderByOrderNumberFromDb, markAbandonedCartsRecoveredByEmail, upsertOrderInDb } from '@/lib/ordersDb';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateOrderPostalCodes } from '@/lib/postalValidation';
import { validateCustomer, validateShippingAddress, validateStockAvailability } from '@/lib/orderValidation';
import { getIdempotencyKey, getCachedCardPayment, setCachedCardPayment } from '@/lib/idempotency';
import { normalizeCartItemsWithTrustedPrices } from '@/lib/trustedCartPricing';
import { createOrderConfirmationToken } from '@/lib/orderConfirmationToken';
import { buildSafeApiError } from '@/lib/apiError';
import { createHostedCardPayment, getCardPaymentsConnection } from '@/lib/cardPaymentsApi';
import { paymentCountryCode, paymentRegionCode } from '@/lib/paymentAddress';
import { createAffiliateCommissionSnapshot } from '@/lib/affiliateCommissions';
import { prepareMetaOrderTracking } from '@/lib/metaConversions';
import { calculateCheckoutPricing } from '@/lib/checkoutPricing';
import { CREDIT_CARD_PAYMENTS_ENABLED } from '@/lib/creditCardAvailability';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface OrderPayload {
	customer: {
		firstName: string;
		lastName: string;
		country: string;
		email: string;
		phone?: string;
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
		id: string | number;
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
	if (!CREDIT_CARD_PAYMENTS_ENABLED) {
		return json({ ok: false, error: 'Credit card payments are temporarily unavailable. Please use e-transfer.' }, { status: 503 });
	}
	const CHECKOUT_RATE_LIMIT = 10;
	const CHECKOUT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

	try {
		const { allowed } = checkRateLimit(request, 'checkout', CHECKOUT_RATE_LIMIT, CHECKOUT_WINDOW_MS);
		if (!allowed) {
			return json({ ok: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
		}

		const rawPayload = (await request.json()) as OrderPayload & { company?: string; idempotencyKey?: string };

		const idemKey = getIdempotencyKey(request, rawPayload);
		if (idemKey) {
			const cached = await getCachedCardPayment(idemKey);
			if (cached) {
				const cachedOrder = await getOrderByOrderNumberFromDb(cached.orderNumber);
				const cachedPayment = cachedOrder?.cardPayments as { final?: boolean } | undefined;
				if (cachedOrder?.paymentStatus !== 'pending' || cachedPayment?.final === true) {
					return json({ ok: false, error: 'This payment has already been processed. Please check your order confirmation.' }, { status: 409 });
				}
				const cachedToken = createOrderConfirmationToken(cached.orderNumber);
				return json({
					ok: true,
					redirectUrl: cached.redirectUrl,
					orderNumber: cached.orderNumber,
					confirmationToken: cachedToken ?? null,
				});
			}
		}

		const { company: _hp, idempotencyKey: _idem, ...orderPayload } = rawPayload;

		// This route is for credit card only; e-transfer uses POST /api/orders
		if (orderPayload.paymentMethod !== 'creditcard') {
			return json({ ok: false, error: 'Invalid payment method for this endpoint.' }, { status: 400 });
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
		const phone = String(orderPayload.customer.phone ?? '').trim();
		if (!/^\+?[0-9 ()-]{7,32}$/.test(phone)) {
			return json({ ok: false, error: 'A valid phone number is required for card payment.' }, { status: 400 });
		}
		const billingLine1 = [orderPayload.customer.address, orderPayload.customer.addressLine2].filter(Boolean).join(', ').trim();
		if (billingLine1.length > 256) {
			return json({ ok: false, error: 'Billing address is too long for card payment.' }, { status: 400 });
		}
		const shippingLine1 = orderPayload.shipToDifferentAddress
			? [orderPayload.shippingAddress?.address, orderPayload.shippingAddress?.addressLine2].filter(Boolean).join(', ').trim()
			: '';
		if (shippingLine1.length > 256) {
			return json({ ok: false, error: 'Shipping address is too long for card payment.' }, { status: 400 });
		}
		const ipAddress = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
		if (!ipAddress || isIP(ipAddress) === 0) {
			return json({ ok: false, error: 'Unable to verify your connection. Please try again.' }, { status: 400 });
		}

		let stockError: string | null;
		try {
			stockError = await validateStockAvailability(
				orderPayload.cartItems.map((item) => ({ id: String(item.id), name: item.name, quantity: item.quantity })),
				readProducts,
			);
		} catch (error) {
			return json(
				{
					ok: false,
					error: 'Unable to verify product availability. Please try again later.',
				},
				{ status: 503 },
			);
		}
		if (stockError) {
			return json({ ok: false, error: stockError }, { status: 400 });
		}

		// Validate credit card limit
		if (orderPayload.paymentMethod === 'creditcard' && orderPayload.total > 500) {
			return json(
				{
					ok: false,
					error: 'Credit card payments are limited to $500 per transaction. Please select another payment method.',
				},
				{ status: 400 },
			);
		}
		const products = await readProducts();
		const trustedCart = normalizeCartItemsWithTrustedPrices(orderPayload.cartItems, products);
		if (!trustedCart.ok) {
			return json({ ok: false, error: trustedCart.error }, { status: 400 });
		}
		const trustedCartItems = trustedCart.items;

		const destinationZipCode = orderPayload.shipToDifferentAddress ? orderPayload.shippingAddress?.zipCode : orderPayload.customer.zipCode;
		const destinationProvince = orderPayload.shipToDifferentAddress ? orderPayload.shippingAddress?.province : orderPayload.customer.province;
		const promoCodes = await readSheetPromoCodes();
		const pricing = calculateCheckoutPricing({
			trustedCartItems,
			promoCodes,
			requestedPromoCode: orderPayload.promoCode,
			paymentMethod: orderPayload.paymentMethod,
			baseShippingCost: getEffectiveShippingCost(destinationZipCode, destinationProvince),
		});
		if (!pricing.ok) return json({ ok: false, error: pricing.error }, { status: 400 });
		const { cartItems, appliedPromo, subtotal, shippingCost, discountAmount, cardFee, total } = pricing;
		const amountMinor = Math.round(total * 100);
		const connection = await getCardPaymentsConnection();
		if (process.env.NODE_ENV === 'production' && connection.environment !== 'live') {
			return json({ ok: false, error: 'Credit card payments are not yet available.' }, { status: 503 });
		}
		if (!connection.limits?.some((limit) => limit.currency === 'CAD' && amountMinor <= limit.max_amount_minor)) {
			return json({ ok: false, error: 'The payment amount is not supported.' }, { status: 400 });
		}

		// Reject tampered totals
		if (Math.abs(total - orderPayload.total) > 0.01) {
			return json({ ok: false, error: 'Order total mismatch. Please refresh and try again.' }, { status: 400 });
		}

		const payload: OrderPayload = {
			...orderPayload,
			cartItems: cartItems.map((item) => ({ ...item, id: item.id })),
			subtotal,
			shippingCost,
			discountAmount,
			promoCode: appliedPromo?.code,
			cardFee,
			total,
		};

		const timestamp = Date.now();
		const orderNumber = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
		const orderId = `order_${timestamp}`;
		const createdAt = new Date().toISOString();
		const metaTracking = prepareMetaOrderTracking(request);

		const confirmationToken = createOrderConfirmationToken(orderNumber);
		const confirmationParams = new URLSearchParams({ orderNumber });
		if (confirmationToken) {
			confirmationParams.set('token', confirmationToken);
		}

		const isProduction = process.env.NODE_ENV === 'production';
		const configuredBaseUrl = process.env.APP_BASE_URL?.replace(/\/$/, '');
		if (isProduction && configuredBaseUrl !== 'https://puretide.ca') throw new Error('APP_BASE_URL must be https://puretide.ca for card payments');
		const tcompleteBase = configuredBaseUrl ?? process.env.NGROK_URL;
		if (!tcompleteBase || !tcompleteBase.startsWith('https://')) throw new Error('An HTTPS APP_BASE_URL is required for card payments');
		const tcomplete = `${tcompleteBase.replace(/\/$/, '')}/order-confirmation?${confirmationParams.toString()}`;

		// Build order record
		const orderRecord = {
			id: orderId,
			orderNumber,
			createdAt,
			...metaTracking,
			paymentStatus: 'pending' as const,
			paymentProvider: 'gatewaylinx_api',
			...payload,
			affiliateCommission: createAffiliateCommissionSnapshot(appliedPromo, payload),
			cardPayments: {
				environment: connection.environment,
				final: false,
				nextCheckAt: new Date(Date.now() + 60_000).toISOString(),
			},
		};
		await upsertOrderInDb(orderRecord as Record<string, unknown>);
		const country = paymentCountryCode(payload.customer.country);
		const payment = await createHostedCardPayment({
			reference: orderNumber,
			amountMinor,
			currency: 'CAD',
			merchant_redirect_url: tcomplete,
			customer: {
				first_name: payload.customer.firstName,
				last_name: payload.customer.lastName,
				email: payload.customer.email,
				phone,
				ip_address: ipAddress,
				billing_address: {
					line1: billingLine1,
					city: payload.customer.city,
					state: paymentRegionCode(payload.customer.province, country),
					postal_code: payload.customer.zipCode,
					country,
				},
			},
			shipping: {
				first_name: payload.customer.firstName,
				last_name: payload.customer.lastName,
				phone,
				address: payload.shipToDifferentAddress && payload.shippingAddress
					? {
						line1: payload.shippingAddress.address,
						...(payload.shippingAddress.addressLine2 ? { line2: payload.shippingAddress.addressLine2 } : {}),
						city: payload.shippingAddress.city,
						state: paymentRegionCode(payload.shippingAddress.province, country),
						postal_code: payload.shippingAddress.zipCode,
						country,
					}
					: {
						line1: payload.customer.address,
						...(payload.customer.addressLine2 ? { line2: payload.customer.addressLine2 } : {}),
						city: payload.customer.city,
						state: paymentRegionCode(payload.customer.province, country),
						postal_code: payload.customer.zipCode,
						country,
					},
			},
		});
		await upsertOrderInDb({ ...orderRecord, cardPayments: { ...orderRecord.cardPayments, id: payment.id, outcome: payment.outcome, final: payment.final, nextCheckAt: new Date(Date.now() + Math.max(60, payment.poll_after_seconds ?? 300) * 1000).toISOString() } });
		await markAbandonedCartsRecoveredByEmail(payload.customer.email, createdAt);

		console.log(
			JSON.stringify({
				label: 'creditcard:create',
				orderNumber,
				total,
				paymentProvider: 'gatewaylinx_api',
				paymentId: payment.id,
			}),
		);

		if (idemKey) await setCachedCardPayment(idemKey, orderNumber, payment.checkout_url!);
		return json({
			ok: true,
			redirectUrl: payment.checkout_url,
			orderNumber,
			confirmationToken: confirmationToken ?? null,
		});
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to create payment.', error, logLabel: 'creditcard:create' });
		console.error(JSON.stringify({ label: 'creditcard:create:error', errorId: safe.errorId }));
		return json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
