import { Product } from '@/types/product';

export type OrderPaymentStatus = 'pending' | 'paid' | 'failed';

export type Order = {
	id: string;
	orderNumber: string;
	createdAt: string;
	paymentStatus: OrderPaymentStatus;
	paymentMethod: 'etransfer' | 'digipay';
	customer: {
		name: string;
		email: string;
		phone?: string;
	};
	shippingInfo: {
		addressLine1: string;
		addressLine2?: string;
		city: string;
		province: string;
		postalCode: string;
		country: string;
	};
	items: Array<{
		sku: string;
		quantity: number;
		unitPrice: number;
		total: number;
	}>;
	subtotal: number;
	discount: {
		code?: string;
		type: 'percentage' | 'fixed' | 'free_shipping';
		value: number;
		amountOff: number;
	};
	shipping: {
		method: 'lettermail' | 'expedited';
		cost: number;
	};
	tax: {
		rate: number;
		amount: number;
	};
	total: number;
	paidAt?: string;
	digipaySession?: string;
	digipayRedirectUrl?: string;
};

export type OrderComputationInput = {
	items: Array<{ sku: string; quantity: number; price: number }>;
	promoCode?: string;
	province: string;
	shippingMethod: 'lettermail' | 'expedited';
};

export type OrderComputation = {
	subtotal: number;
	discount: {
		code?: string;
		type: 'percentage' | 'fixed' | 'free_shipping';
		value: number;
		amountOff: number;
	} | null;
	shipping: {
		method: 'lettermail' | 'expedited';
		cost: number;
	};
	tax: {
		rate: number;
		amount: number;
	};
	total: number;
};

const TAX_RATES = {
	AB: 0.05,
	BC: 0.12,
	MB: 0.12,
	NB: 0.15,
	NL: 0.15,
	NT: 0.05,
	NS: 0.15,
	NU: 0.05,
	ON: 0.13,
	PE: 0.15,
	QC: 0.14975,
	SK: 0.11,
	YT: 0.05,
} as const;

const SHIPPING_COSTS = {
	lettermail: 3,
	expedited: 15,
} as const;

export function computeOrderTotals(input: OrderComputationInput): OrderComputation {
	const subtotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

	let discount = null;
	if (input.promoCode) {
		// Note: In real usage, this would be validated against active promos from Google Sheets
		// For now, we apply a simple 10% off for demonstration if a code is provided
		discount = {
			code: input.promoCode,
			type: 'percentage' as 'percentage' | 'fixed' | 'free_shipping',
			value: 10,
			amountOff: Math.round(subtotal * 0.1),
		};
	}

	const taxRate = TAX_RATES[input.province as keyof typeof TAX_RATES] ?? 0.13;

	const shippingCost = discount?.type === 'free_shipping' ? 0 : SHIPPING_COSTS[input.shippingMethod];

	const taxableAmount = subtotal - (discount?.amountOff ?? 0) + shippingCost;
	const taxAmount = Math.round(taxableAmount * taxRate);

	const total = subtotal - (discount?.amountOff ?? 0) + shippingCost + taxAmount;

	return {
		subtotal,
		discount,
		shipping: {
			method: input.shippingMethod,
			cost: shippingCost,
		},
		tax: {
			rate: taxRate,
			amount: taxAmount,
		},
		total,
	};
}

export function validateOrderStateTransition(from: OrderPaymentStatus, to: OrderPaymentStatus): boolean {
	switch (from) {
		case 'pending':
			return to === 'paid' || to === 'failed';
		case 'paid':
		case 'failed':
			// Terminal states: no further transitions allowed
			return false;
		default:
			return false;
	}
}
