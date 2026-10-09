import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAffiliateReport, createAffiliateCommissionSnapshot } from '../lib/affiliateCommissions';
import type { PromoCode } from '../types/product';

const affiliatePromo: PromoCode = {
	code: 'PUREBOYES',
	discount: 10,
	affiliateName: 'Pure Boyes',
	commissionPercentage: 15,
	active: true,
};

test('creates a commission snapshot from discounted merchandise revenue', () => {
	assert.deepEqual(createAffiliateCommissionSnapshot(affiliatePromo, { subtotal: 100, discountAmount: 10 }), {
		code: 'PUREBOYES',
		affiliateName: 'Pure Boyes',
		commissionPercentage: 15,
		commissionableAmount: 90,
		commissionAmount: 13.5,
	});
});

test('shows pending conversions but only counts paid commission as owed', () => {
	const report = buildAffiliateReport({
		month: '2026-09',
		promoCodes: [affiliatePromo],
		orders: [
			{
				orderNumber: 'PAID-1',
				createdAt: '2026-09-15T18:00:00.000Z',
				paymentStatus: 'paid',
				promoCode: 'pureboyes',
				subtotal: 100,
				discountAmount: 10,
				shippingCost: 15,
				total: 105,
				customer: { firstName: 'Avery', lastName: 'Lee' },
			},
			{
				orderNumber: 'PENDING-1',
				createdAt: '2026-09-16T18:00:00.000Z',
				paymentStatus: 'pending',
				promoCode: 'PUREBOYES',
				subtotal: 200,
				discountAmount: 20,
				total: 180,
			},
		],
	});

	assert.equal(report.usageCount, 2);
	assert.equal(report.paidUsageCount, 1);
	assert.equal(report.grossOrderAmount, 285);
	assert.equal(report.commissionableRevenue, 270);
	assert.equal(report.totalCommission, 13.5);
	assert.equal(report.pendingCommission, 27);
	assert.equal(report.affiliates[0]?.orders.find((order) => order.orderNumber === 'PAID-1')?.customerName, 'Avery Lee');
});

test('uses the stored snapshot when the current promo rate changes', () => {
	const report = buildAffiliateReport({
		month: '2026-09',
		promoCodes: [{ ...affiliatePromo, commissionPercentage: 5 }],
		orders: [
			{
				orderNumber: 'HISTORIC-1',
				createdAt: '2026-09-30T08:00:00.000Z',
				paymentStatus: 'paid',
				promoCode: 'PUREBOYES',
				total: 100,
				affiliateCommission: {
					code: 'PUREBOYES',
					affiliateName: 'Pure Boyes',
					commissionPercentage: 20,
					commissionableAmount: 80,
					commissionAmount: 16,
				},
			},
		],
	});

	assert.equal(report.affiliates[0]?.commissionPercentage, 20);
	assert.equal(report.totalCommission, 16);
});

test('uses Vancouver time when assigning orders to a month', () => {
	const report = buildAffiliateReport({
		month: '2026-09',
		promoCodes: [affiliatePromo],
		orders: [
			{
				orderNumber: 'MONTH-EDGE',
				createdAt: '2026-10-01T06:30:00.000Z',
				paymentStatus: 'paid',
				promoCode: 'PUREBOYES',
				subtotal: 100,
				discountAmount: 0,
				total: 100,
			},
		],
	});

	assert.equal(report.usageCount, 1);
});
