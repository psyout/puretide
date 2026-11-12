import type { PromoCode } from '@/types/product';

type PromoCartItem = { id: string | number; price: number; quantity: number };

export const AUTOMATIC_SITEWIDE_PROMO_CODE = 'SITEWIDE25';
export const AUTOMATIC_SITEWIDE_DISCOUNT = 25;

export function isAutomaticSitewideSaleEnabled(): boolean {
	return String(process.env.SITEWIDE_25_SALE_ENABLED ?? '').trim().toLowerCase() === 'true';
}

function getVancouverDateKey(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Vancouver',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(date);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${values.year}-${values.month}-${values.day}`;
}

function normalizeDateOnly(value: string): string | null {
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const northAmericanDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (!northAmericanDate) return null;
	const [, month, day, year] = northAmericanDate;
	return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function isPromoActive(promo: PromoCode, now = new Date()): boolean {
	if (!promo.active) return false;
	const startDate = promo.startDate?.trim();
	const endDate = promo.endDate?.trim();
	const currentDateKey = getVancouverDateKey(now);

	if (startDate) {
		const startDateOnly = normalizeDateOnly(startDate);
		if (startDateOnly) {
			if (currentDateKey < startDateOnly) return false;
		} else {
			const start = new Date(startDate);
			if (!Number.isNaN(start.getTime()) && now < start) return false;
		}
	}

	if (endDate) {
		const endDateOnly = normalizeDateOnly(endDate);
		if (endDateOnly) {
			if (currentDateKey > endDateOnly) return false;
		} else {
			const end = new Date(endDate);
			if (!Number.isNaN(end.getTime()) && now > end) return false;
		}
	}

	return true;
}

export function getAutomaticSitewidePromo(promos: PromoCode[], now = new Date(), enabled = isAutomaticSitewideSaleEnabled()): PromoCode | null {
	if (!enabled) return null;

	const configuredPromo = promos.find(
		(promo) =>
			isPromoActive(promo, now) &&
			promo.code.trim().toUpperCase() === AUTOMATIC_SITEWIDE_PROMO_CODE &&
			promo.discount === AUTOMATIC_SITEWIDE_DISCOUNT &&
			(promo.productIds?.length ?? 0) === 0,
	);

	// The feature flag is the source of truth for this fixed campaign. Reuse the
	// sheet row when one is active so its metadata remains available, but do not
	// require an operational sheet edit just to switch the sale on.
	return configuredPromo ?? {
		code: AUTOMATIC_SITEWIDE_PROMO_CODE,
		discount: AUTOMATIC_SITEWIDE_DISCOUNT,
		active: true,
		productIds: [],
	};
}

export function getPromotionForOrder(promos: PromoCode[], requestedCode?: string | null, now = new Date(), sitewideSaleEnabled = isAutomaticSitewideSaleEnabled()): PromoCode | null {
	const automaticPromo = getAutomaticSitewidePromo(promos, now, sitewideSaleEnabled);
	if (automaticPromo) return automaticPromo;
	const normalizedCode = requestedCode?.trim().toUpperCase();
	if (!normalizedCode) return null;
	return promos.find((promo) => promo.code.trim().toUpperCase() === normalizedCode && isPromoActive(promo, now)) ?? null;
}

export function getSalePrice(price: number, discount: number): number {
	return Number((price * (1 - discount / 100)).toFixed(2));
}

export function getPromoEligibleSubtotal(promo: PromoCode, items: PromoCartItem[]): number {
	const eligibleIds = new Set((promo.productIds ?? []).map(String));
	if (eligibleIds.size === 0) {
		return items.reduce((subtotal, item) => subtotal + item.price * item.quantity, 0);
	}
	return items.reduce((subtotal, item) => {
		if (!eligibleIds.has(String(item.id))) return subtotal;
		return subtotal + item.price * item.quantity;
	}, 0);
}

export function getPromoDiscountAmount(promo: PromoCode, items: PromoCartItem[]): number {
	return Number((getPromoEligibleSubtotal(promo, items) * (promo.discount / 100)).toFixed(2));
}

export function getPromoProductEligibilityError(promo: PromoCode, items: PromoCartItem[]): string | null {
	if (promo.discount <= 0 || getPromoEligibleSubtotal(promo, items) > 0) return null;
	return `${promo.code} does not apply to the products in your cart.`;
}

export function getPromoMinimumSubtotalError(params: { promo: PromoCode; subtotal: number }): string | null {
	const { promo, subtotal } = params;
	const minimumSubtotal = Number(promo.minimumSubtotal ?? 0);
	if (!Number.isFinite(minimumSubtotal) || minimumSubtotal <= 0) return null;
	if (subtotal >= minimumSubtotal) return null;
	return `${promo.code} requires a minimum order of $${minimumSubtotal}.`;
}
