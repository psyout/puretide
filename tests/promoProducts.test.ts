import test from 'node:test';
import assert from 'node:assert/strict';

import { getAutomaticSitewidePromo, getPromoDiscountAmount, getPromoEligibleSubtotal, getPromoProductEligibilityError, getPromotionForOrder, getSalePrice, isPromoActive } from '../lib/promo';
import type { PromoCode } from '../types/product';

const items = [
	{ id: 'bpc-157', price: 70, quantity: 2 },
	{ id: 'ghk-cu', price: 50, quantity: 1 },
];

test('a promo with no product selection discounts all products', () => {
	const promo: PromoCode = { code: 'SAVE10', discount: 10, active: true };
	assert.equal(getPromoEligibleSubtotal(promo, items), 190);
	assert.equal(getPromoDiscountAmount(promo, items), 19);
	assert.equal(getPromoProductEligibilityError(promo, items), null);
});

test('a product-specific promo only discounts selected product IDs', () => {
	const promo: PromoCode = { code: 'BPC10', discount: 10, productIds: ['bpc-157'], active: true };
	assert.equal(getPromoEligibleSubtotal(promo, items), 140);
	assert.equal(getPromoDiscountAmount(promo, items), 14);
});

test('a product-specific promo gives no discount without an eligible cart item', () => {
	const promo: PromoCode = { code: 'OTHER10', discount: 10, productIds: ['other'], active: true };
	assert.equal(getPromoDiscountAmount(promo, items), 0);
	assert.equal(getPromoProductEligibilityError(promo, items), 'OTHER10 does not apply to the products in your cart.');
});

test('SITEWIDE25 is selected as the automatic sale only while active and sitewide', () => {
	const promos: PromoCode[] = [
		{ code: 'SAVE10', discount: 10, active: true },
		{ code: 'SITEWIDE25', discount: 25, active: true },
	];
	assert.equal(getAutomaticSitewidePromo(promos)?.discount, 25);
	assert.equal(getAutomaticSitewidePromo([{ ...promos[1], active: false }]), null);
	assert.equal(getAutomaticSitewidePromo([{ ...promos[1], productIds: ['bpc-157'] }]), null);
});

test('sale prices are rounded to currency precision', () => {
	assert.equal(getSalePrice(150, 25), 112.5);
	assert.equal(getSalePrice(99.99, 25), 74.99);
});

test('promo date range is inclusive in Vancouver time', () => {
	const promo: PromoCode = { code: 'SITEWIDE25', discount: 25, active: true, startDate: '2026-10-09', endDate: '2026-10-12' };
	assert.equal(isPromoActive(promo, new Date('2026-10-09T07:00:00.000Z')), true);
	assert.equal(isPromoActive(promo, new Date('2026-10-13T06:59:59.000Z')), true);
	assert.equal(isPromoActive(promo, new Date('2026-10-13T07:00:00.000Z')), false);
});

test('automatic sale is not selected before or after its schedule', () => {
	const promo: PromoCode = { code: 'SITEWIDE25', discount: 25, active: true, startDate: '2026-10-10', endDate: '2026-10-12' };
	assert.equal(getAutomaticSitewidePromo([promo], new Date('2026-10-09T19:00:00.000Z')), null);
	assert.equal(getAutomaticSitewidePromo([promo], new Date('2026-10-11T19:00:00.000Z'))?.code, 'SITEWIDE25');
	assert.equal(getAutomaticSitewidePromo([promo], new Date('2026-10-14T19:00:00.000Z')), null);
});

test('Google Sheets North American date formatting remains an inclusive date', () => {
	const promo: PromoCode = { code: 'SITEWIDE25', discount: 25, active: true, startDate: '10/9/2026', endDate: '10/12/2026' };
	assert.equal(isPromoActive(promo, new Date('2026-10-13T06:59:59.000Z')), true);
	assert.equal(isPromoActive(promo, new Date('2026-10-13T07:00:00.000Z')), false);
});

test('active sitewide sale overrides quantity pricing and any submitted promo code', () => {
	const promos: PromoCode[] = [
		{ code: 'AFFILIATE10', discount: 10, active: true },
		{ code: 'SITEWIDE25', discount: 25, active: true, startDate: '2026-10-09', endDate: '2026-10-31' },
	];
	const selected = getPromotionForOrder(promos, 'AFFILIATE10', new Date('2026-10-15T19:00:00.000Z'));
	assert.equal(selected?.code, 'SITEWIDE25');
	assert.equal(selected?.discount, 25);
});

test('regular promo selection returns after the sitewide sale ends', () => {
	const promos: PromoCode[] = [
		{ code: 'AFFILIATE10', discount: 10, active: true },
		{ code: 'SITEWIDE25', discount: 25, active: true, endDate: '2026-10-31' },
	];
	assert.equal(getPromotionForOrder(promos, 'AFFILIATE10', new Date('2026-11-01T20:00:00.000Z'))?.code, 'AFFILIATE10');
});
