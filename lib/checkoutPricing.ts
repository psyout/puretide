import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import {
	getPromoDiscountAmount,
	getPromoMinimumSubtotalError,
	getPromoProductEligibilityError,
	getPromotionForOrder,
	isAutomaticSitewideSaleEnabled,
} from '@/lib/promo';
import { getDiscountedPrice } from '@/lib/pricing';
import type { PromoCode } from '@/types/product';

export const CREDIT_CARD_FEE_RATE = 0.05;

type CheckoutPricingItem = {
	id: string | number;
	price: number;
	quantity: number;
};

type CheckoutPricingResult<T extends CheckoutPricingItem> =
	| { ok: false; error: string }
	| {
			ok: true;
			cartItems: T[];
			appliedPromo?: PromoCode;
			subtotal: number;
			discountAmount: number;
			subtotalAfterDiscounts: number;
			shippingCost: number;
			cardFee: number;
			total: number;
	  };

export function calculateCheckoutPricing<T extends CheckoutPricingItem>(params: {
	trustedCartItems: T[];
	promoCodes: PromoCode[];
	requestedPromoCode?: string | null;
	paymentMethod: 'etransfer' | 'creditcard';
	baseShippingCost: number;
	sitewideSaleEnabled?: boolean;
}): CheckoutPricingResult<T> {
	const {
		trustedCartItems,
		promoCodes,
		requestedPromoCode,
		paymentMethod,
		baseShippingCost,
		sitewideSaleEnabled = isAutomaticSitewideSaleEnabled(),
	} = params;
	const promo = getPromotionForOrder(promoCodes, requestedPromoCode, new Date(), sitewideSaleEnabled);
	let cartItems: T[];
	let discountAmount = 0;
	let shippingCost = baseShippingCost;

	if (promo) {
		cartItems = trustedCartItems.map((item) => ({ ...item, price: item.price }));
		const rawSubtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
		const minimumError = getPromoMinimumSubtotalError({ promo, subtotal: rawSubtotal });
		if (minimumError) return { ok: false, error: minimumError };
		const eligibilityError = getPromoProductEligibilityError(promo, cartItems);
		if (eligibilityError) return { ok: false, error: eligibilityError };
		if (promo.freeShipping) shippingCost = 0;
		discountAmount = getPromoDiscountAmount(promo, cartItems);
	} else {
		cartItems = trustedCartItems.map((item) => ({
			...item,
			price: getDiscountedPrice(item.price, item.quantity),
		}));
	}

	const subtotal = Number(cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
	const subtotalAfterDiscounts = Number((subtotal - discountAmount).toFixed(2));
	if (subtotalAfterDiscounts > FREE_SHIPPING_THRESHOLD) shippingCost = 0;
	const cardFee = paymentMethod === 'creditcard' ? Number((subtotalAfterDiscounts * CREDIT_CARD_FEE_RATE).toFixed(2)) : 0;
	const total = Number((subtotalAfterDiscounts + shippingCost + cardFee).toFixed(2));

	return {
		ok: true,
		cartItems,
		appliedPromo: promo ?? undefined,
		subtotal,
		discountAmount,
		subtotalAfterDiscounts,
		shippingCost,
		cardFee,
		total,
	};
}
