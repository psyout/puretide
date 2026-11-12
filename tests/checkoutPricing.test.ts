import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateCheckoutPricing } from '../lib/checkoutPricing';
import type { PromoCode } from '../types/product';

const item = { id: 'wolverine-stack', price: 60, quantity: 1 };

test('sitewide sale prices an e-transfer order at 25% off before shipping', () => {
	const result = calculateCheckoutPricing({
		trustedCartItems: [item],
		promoCodes: [],
		requestedPromoCode: 'OTHER10',
		paymentMethod: 'etransfer',
		baseShippingCost: 20,
		sitewideSaleEnabled: true,
	});

	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.appliedPromo?.code, 'SITEWIDE25');
	assert.equal(result.subtotal, 60);
	assert.equal(result.discountAmount, 15);
	assert.equal(result.subtotalAfterDiscounts, 45);
	assert.equal(result.shippingCost, 20);
	assert.equal(result.cardFee, 0);
	assert.equal(result.total, 65);
});

test('sitewide sale computes the credit-card fee from the discounted merchandise subtotal', () => {
	const result = calculateCheckoutPricing({
		trustedCartItems: [item],
		promoCodes: [],
		paymentMethod: 'creditcard',
		baseShippingCost: 20,
		sitewideSaleEnabled: true,
	});

	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.discountAmount, 15);
	assert.equal(result.cardFee, 2.25);
	assert.equal(result.total, 67.25);
});

test('normal promo and quantity behavior returns when the sitewide flag is disabled', () => {
	const promos: PromoCode[] = [{ code: 'OTHER10', discount: 10, active: true }];
	const result = calculateCheckoutPricing({
		trustedCartItems: [{ ...item, quantity: 3 }],
		promoCodes: promos,
		requestedPromoCode: 'OTHER10',
		paymentMethod: 'etransfer',
		baseShippingCost: 20,
		sitewideSaleEnabled: false,
	});

	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.subtotal, 180);
	assert.equal(result.discountAmount, 18);
	assert.equal(result.total, 182);
});
