/**
 * Canadian postal code: A1A 1A1 (letter-digit-letter space digit-letter-digit)
 */
export function isValidCanadianPostalCode(zip: string): boolean {
	return /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test((zip ?? '').trim().replace(/\s{2,}/g, ' '));
}

export function isQuebecPostalCode(zip: string): boolean {
	return /^[GHJ]/i.test((zip ?? '').trim().replace(/\s/g, ''));
}

export type OrderWithPostalCodes = {
	customer: { zipCode?: string };
	shippingAddress?: { zipCode?: string };
	shipToDifferentAddress?: boolean;
};

export type ShippingAddressInput = {
	address?: string;
	addressLine2?: string;
	city?: string;
	province?: string;
	zipCode?: string;
};

/**
 * When shipToDifferentAddress is true, require shipping address object and validate its postal code.
 * Returns an error message if billing or shipping postal code is invalid or Quebec; otherwise null.
 */
export function validateOrderPostalCodes(payload: OrderWithPostalCodes): string | null {
	const billingZip = (payload.customer?.zipCode ?? '').trim().replace(/\s/g, '');
	if (billingZip.length > 0 && !isValidCanadianPostalCode(payload.customer?.zipCode ?? '')) {
		return 'Invalid postal code format. Please use format A1A 1A1.';
	}
	if (isQuebecPostalCode(payload.customer?.zipCode ?? '')) {
		return 'We do not ship to Quebec. Please contact us if you have questions.';
	}
	if (payload.shipToDifferentAddress) {
		if (!payload.shippingAddress || typeof payload.shippingAddress !== 'object') {
			return 'Shipping address is required when shipping to a different address.';
		}
		const shippingZip = (payload.shippingAddress.zipCode ?? '').trim().replace(/\s/g, '');
		if (!shippingZip) {
			return 'Shipping postal code is required.';
		}
		if (!isValidCanadianPostalCode(payload.shippingAddress.zipCode ?? '')) {
			return 'Invalid shipping postal code format. Please use format A1A 1A1.';
		}
		if (isQuebecPostalCode(payload.shippingAddress.zipCode ?? '')) {
			return 'We do not ship to Quebec. Please contact us if you have questions.';
		}
	}
	return null;
}
