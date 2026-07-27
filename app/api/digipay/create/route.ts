import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { readSheetProducts } from '@/lib/stockSheet';
import { getCachedSheetPromoCodes } from '@/lib/sheetCache';
import type { PromoCode } from '@/types/product';
import { getPromoMinimumSubtotalError } from '@/lib/promo';
import { getDiscountedPrice } from '@/lib/pricing';
import { getEffectiveShippingCost, FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import { upsertOrderInDb } from '@/lib/ordersDb';
import { checkRateLimit } from '@/lib/rateLimit';
import { validateOrderPostalCodes } from '@/lib/postalValidation';
import { validateCustomer, validateShippingAddress, validateStockAvailability } from '@/lib/orderValidation';
import { getIdempotencyKey, getCachedDigipay, setCachedDigipay } from '@/lib/idempotency';
import { normalizeCartItemsWithTrustedPrices } from '@/lib/trustedCartPricing';
import { createOrderConfirmationToken } from '@/lib/orderConfirmationToken';
import { buildSafeApiError } from '@/lib/apiError';
import { getPaymentProvider } from '@/lib/paymentProvider';
import { getGatewaylinxConfig } from '@/lib/env';
import { validateEnv } from '@/lib/env';

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
	// Validate environment before processing
	validateEnv();

	const siteId = process.env.DIGIPAY_SITE_ID;
	const encryptionKey = process.env.DIGIPAY_ENCRYPTION_KEY;
	const pburl = process.env.DIGIPAY_POSTBACK_URL;
	const tcompleteBase = process.env.DIGIPAY_TCOMPLETE_BASE;

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
				const cachedToken = createOrderConfirmationToken(cached.orderNumber);
				return json({ ok: true, redirectUrl: cached.redirectUrl, orderNumber: cached.orderNumber, confirmationToken: cachedToken ?? null });
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

		let stockError: string | null;
		try {
			stockError = await validateStockAvailability(
				orderPayload.cartItems.map((item) => ({ id: String(item.id), name: item.name, quantity: item.quantity })),
				readSheetProducts,
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
		const products = await readSheetProducts();
		const trustedCart = normalizeCartItemsWithTrustedPrices(orderPayload.cartItems, products);
		if (!trustedCart.ok) {
			return json({ ok: false, error: trustedCart.error }, { status: 400 });
		}
		const trustedCartItems = trustedCart.items;

		// Promo and volume discount cannot stack: if valid promo, use raw prices; else apply volume discount
		const destinationZipCode = orderPayload.shipToDifferentAddress ? orderPayload.shippingAddress?.zipCode : orderPayload.customer.zipCode;
		const destinationProvince = orderPayload.shipToDifferentAddress ? orderPayload.shippingAddress?.province : orderPayload.customer.province;
		let shippingCost = getEffectiveShippingCost(destinationZipCode, destinationProvince);
		let cartItems: Array<{ id: number | string; name: string; price: number; quantity: number; image: string; description: string }>;
		let discountAmount = 0;

		if (orderPayload.promoCode) {
			const promoCodes = await getCachedSheetPromoCodes();
			const promo = promoCodes.find((p: PromoCode) => p.code === orderPayload.promoCode?.trim().toUpperCase() && p.active);
			if (promo) {
				cartItems = trustedCartItems.map((item) => ({ ...item, price: item.price }));
				const subtotalWithPromo = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
				const minimumError = getPromoMinimumSubtotalError({ promo, subtotal: subtotalWithPromo });
				if (minimumError) {
					return json({ ok: false, error: minimumError }, { status: 400 });
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
			cartItems: cartItems.map((item) => ({ ...item, id: item.id })),
			subtotal,
			shippingCost,
			discountAmount,
			cardFee,
			total,
		};

		const timestamp = Date.now();
		const orderNumber = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
		const createdAt = new Date().toISOString();

		const confirmationToken = createOrderConfirmationToken(orderNumber);
		const confirmationParams = new URLSearchParams({ orderNumber });
		if (confirmationToken) {
			confirmationParams.set('token', confirmationToken);
		}

		// Use provider abstraction for unified credit card handling
		const provider = getPaymentProvider();
		const gatewaylinxConfig = getGatewaylinxConfig();

		// Compute base URL early — needed for both tcomplete and postback.
		// Gatewaylinx requires public HTTPS URLs for both tcomplete (return URL) and pburl (postback URL).
		// Localhost URLs are blocked by the processor's firewall and cause indeterminate responses.
		const ngrokUrl = process.env.NGROK_URL;
		const reqProtocol = request.headers.get('x-forwarded-proto') || 'https';
		const reqHost = request.headers.get('host');
		const siteBaseUrl = reqHost ? `${reqProtocol}://${reqHost}` : undefined;
		const isProduction = process.env.NODE_ENV === 'production';
		const configuredBaseUrl = process.env.APP_BASE_URL?.replace(/\/$/, '');
		if (gatewaylinxConfig && isProduction && !configuredBaseUrl) {
			throw new Error('APP_BASE_URL is required for Gatewaylinx in production');
		}
		// Production uses the real HTTPS domain; NGROK_URL is local-development-only.
		const gatewaylinxBaseUrl = configuredBaseUrl ?? (!isProduction ? (ngrokUrl ?? siteBaseUrl) : siteBaseUrl);
		const tcompleteBase = gatewaylinxConfig ? gatewaylinxBaseUrl : (configuredBaseUrl ?? process.env.DIGIPAY_TCOMPLETE_BASE) || 'https://puretide.com';
		if (!tcompleteBase) {
			throw new Error('A public callback URL is required for Gatewaylinx');
		}
		const tcomplete = `${tcompleteBase.replace(/\/$/, '')}/order-confirmation?${confirmationParams.toString()}`;

		console.log(JSON.stringify({ label: 'digipay:create:tcomplete', tcomplete, siteBaseUrl, gatewaylinxBaseUrl }));

		// Build order record
		const orderRecord = {
			id: `order_${timestamp}`,
			orderNumber,
			createdAt,
			paymentStatus: 'pending' as const,
			paymentProvider: gatewaylinxConfig ? 'gatewaylinx' : 'digipay',
			...payload,
		};

		// Add provider-specific config to order record
		if (gatewaylinxConfig) {
			(orderRecord as Record<string, unknown>).gatewaylinx = {
				siteId: gatewaylinxConfig.siteId,
				dryRunFulfillment: gatewaylinxConfig.dryRunFulfillment,
				tcomplete,
			};
		} else {
			const useSandbox = process.env.DIGIPAY_USE_SANDBOX === 'true';
			const sandboxSiteId = process.env.DIGIPAY_SANDBOX_SITE_ID;
			const effectiveSiteId = useSandbox && sandboxSiteId ? sandboxSiteId : siteId;
			(orderRecord as Record<string, unknown>).digipay = {
				useSandbox,
				siteId: effectiveSiteId,
				pburl,
				tcomplete,
			};
		}

		await upsertOrderInDb(orderRecord as Record<string, unknown>);

		// Build postback URL using the Gatewaylinx base URL computed above (must be public HTTPS)
		const postbackPath = gatewaylinxConfig ? '/api/creditcard/webhook' : '/api/digipay/postback';
		const postbackBaseUrl = gatewaylinxConfig ? gatewaylinxBaseUrl : siteBaseUrl;
		const postbackUrl = `${postbackBaseUrl}${postbackPath}`;

		// Extract real customer IP for fraud scoring. Omit loopback/localhost IPs because the processor
		// rejects them; Gatewaylinx will fall back to the request source IP.
		const rawCustomerIp = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? request.headers.get('x-real-ip') ?? undefined;
		const customerIp = rawCustomerIp && !/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|0:0:0:0:0:0:0:1|localhost)/i.test(rawCustomerIp) ? rawCustomerIp : undefined;

		// Call provider's createPaymentSession
		const sessionResult = await provider.createPaymentSession({
			orderNumber,
			amount: total,
			returnUrl: tcomplete,
			postbackUrl,
			customerIp,
			customer: {
				firstName: payload.customer.firstName,
				lastName: payload.customer.lastName,
				email: payload.customer.email,
				address: payload.customer.address,
				city: payload.customer.city,
				province: payload.customer.province,
				zipCode: payload.customer.zipCode,
				country: payload.customer.country,
			},
		});

		console.log(
			JSON.stringify({
				label: 'digipay:create',
				orderNumber,
				total,
				paymentProvider: gatewaylinxConfig ? 'gatewaylinx' : 'digipay',
				redirectUrl: sessionResult.redirectUrl,
			}),
		);

		if (idemKey) await setCachedDigipay(idemKey, orderNumber, sessionResult.redirectUrl);
		return json({
			ok: true,
			redirectUrl: sessionResult.redirectUrl,
			orderNumber,
			// Return the confirmation token so the frontend can include it in the post-charge redirect.
			// The same token is embedded in tcomplete for the 3DS return path.
			confirmationToken: confirmationToken ?? null,
		});
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to create payment.', error, logLabel: 'digipay:create' });
		console.error(JSON.stringify({ label: 'digipay:create:error', errorId: safe.errorId }));
		return json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
