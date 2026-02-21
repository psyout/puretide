import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { readSheetPromoCodes } from '@/lib/stockSheet';
import { getDiscountedPrice } from '@/lib/pricing';
import { SHIPPING_COSTS } from '@/lib/constants';
import { buildDigipayPaymentUrl } from '@/lib/digipay';
import { upsertOrderInDb } from '@/lib/ordersDb';

interface OrderPayload {
	customer: {
		firstName: string;
		lastName: string;
		country: string;
		email: string;
		phone: string;
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

	try {
		const rawPayload = (await request.json()) as OrderPayload;

		// Validate payment method
		if (!['creditcard', 'etransfer'].includes(rawPayload.paymentMethod)) {
			return NextResponse.json({ ok: false, error: 'Invalid payment method' }, { status: 400 });
		}

		// Validate cart
		if (!Array.isArray(rawPayload.cartItems) || rawPayload.cartItems.length === 0) {
			return NextResponse.json({ ok: false, error: 'Invalid cart' }, { status: 400 });
		}

		// Recalculate prices server-side
		const cartItems = rawPayload.cartItems.map((item) => ({
			...item,
			price: getDiscountedPrice(item.price, item.quantity),
		}));

		const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

		const shippingCost = SHIPPING_COSTS.express;

		// Promo code validation
		let discountAmount = 0;

		if (rawPayload.promoCode) {
			const promoCodes = await readSheetPromoCodes();
			const promo = promoCodes.find((p) => p.code === rawPayload.promoCode?.trim().toUpperCase() && p.active);

			if (promo) {
				discountAmount = Number((subtotal * (promo.discount / 100)).toFixed(2));
			}
		}

		// Safe card fee handling
		const cardFee = rawPayload.paymentMethod === 'creditcard' && Number.isFinite(Number(rawPayload.cardFee)) ? Number(rawPayload.cardFee) : 0;

		const total = Number((subtotal + shippingCost - discountAmount + cardFee).toFixed(2));

		// Optional tamper detection
		if (Math.abs(total - rawPayload.total) > 0.01) {
			console.warn('Total mismatch detected', {
				clientTotal: rawPayload.total,
				serverTotal: total,
			});
		}

		const payload: OrderPayload = {
			...rawPayload,
			cartItems,
			subtotal,
			shippingCost,
			discountAmount,
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

		// Branch for e-transfer (manual payment)
		if (payload.paymentMethod === 'etransfer') {
			return NextResponse.json({
				ok: true,
				orderNumber,
				manualPayment: true,
			});
		}

		// Build DigiPay redirect (credit card only)
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
