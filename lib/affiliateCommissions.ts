import type { PromoCode } from '@/types/product';

export const DEFAULT_AFFILIATE_REPORT_TIME_ZONE = 'America/Vancouver';

export type AffiliateCommissionSnapshot = {
	code: string;
	affiliateName: string;
	commissionPercentage: number;
	commissionableAmount: number;
	commissionAmount: number;
};

export type AffiliateOrderCommission = AffiliateCommissionSnapshot & {
	orderNumber: string;
	createdAt: string;
	customerName: string;
	orderTotal: number;
	paymentStatus: 'paid' | 'pending';
};

export type AffiliateSummary = {
	code: string;
	affiliateName: string;
	commissionPercentage: number;
	usageCount: number;
	paidUsageCount: number;
	grossOrderAmount: number;
	commissionableRevenue: number;
	totalCommission: number;
	pendingCommission: number;
	orders: AffiliateOrderCommission[];
};

export type AffiliateReport = {
	month: string;
	timeZone: string;
	usageCount: number;
	paidUsageCount: number;
	grossOrderAmount: number;
	commissionableRevenue: number;
	totalCommission: number;
	pendingCommission: number;
	affiliates: AffiliateSummary[];
};

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const numberFrom = (value: unknown) => {
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const normalizePercentage = (value: unknown) => Math.max(0, Math.min(100, numberFrom(value)));

const normalizeCode = (value: unknown) => String(value ?? '').trim().toUpperCase();

const monthInTimeZone = (value: unknown, timeZone: string): string | null => {
	const date = new Date(String(value ?? ''));
	if (Number.isNaN(date.getTime())) return null;
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
	}).formatToParts(date);
	const year = parts.find((part) => part.type === 'year')?.value;
	const month = parts.find((part) => part.type === 'month')?.value;
	return year && month ? `${year}-${month}` : null;
};

const customerName = (order: Record<string, unknown>) => {
	const customer = order.customer as Record<string, unknown> | undefined;
	const name = `${String(customer?.firstName ?? '').trim()} ${String(customer?.lastName ?? '').trim()}`.trim();
	return name || String(customer?.email ?? '').trim() || 'Customer';
};

export function createAffiliateCommissionSnapshot(
	promo: PromoCode | undefined,
	order: { subtotal?: unknown; discountAmount?: unknown },
): AffiliateCommissionSnapshot | undefined {
	if (!promo) return undefined;
	const commissionPercentage = normalizePercentage(promo.commissionPercentage);
	if (commissionPercentage <= 0) return undefined;
	const subtotal = numberFrom(order.subtotal);
	const discountAmount = numberFrom(order.discountAmount);
	const commissionableAmount = money(Math.max(0, subtotal - discountAmount));
	return {
		code: normalizeCode(promo.code),
		affiliateName: String(promo.affiliateName ?? '').trim() || normalizeCode(promo.code),
		commissionPercentage,
		commissionableAmount,
		commissionAmount: money(commissionableAmount * (commissionPercentage / 100)),
	};
}

function snapshotFromOrder(order: Record<string, unknown>): AffiliateCommissionSnapshot | undefined {
	const snapshot = order.affiliateCommission as Partial<AffiliateCommissionSnapshot> | undefined;
	if (!snapshot) return undefined;
	const code = normalizeCode(snapshot.code);
	const commissionPercentage = normalizePercentage(snapshot.commissionPercentage);
	if (!code || commissionPercentage <= 0) return undefined;
	const commissionableAmount = money(Math.max(0, numberFrom(snapshot.commissionableAmount)));
	return {
		code,
		affiliateName: String(snapshot.affiliateName ?? '').trim() || code,
		commissionPercentage,
		commissionableAmount,
		commissionAmount: money(numberFrom(snapshot.commissionAmount) || commissionableAmount * (commissionPercentage / 100)),
	};
}

export function buildAffiliateReport({
	orders,
	promoCodes,
	month,
	timeZone = DEFAULT_AFFILIATE_REPORT_TIME_ZONE,
}: {
	orders: Array<Record<string, unknown>>;
	promoCodes: PromoCode[];
	month: string;
	timeZone?: string;
}): AffiliateReport {
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Month must use YYYY-MM format.');

	const promosByCode = new Map(promoCodes.map((promo) => [normalizeCode(promo.code), promo]));
	const summaries = new Map<string, AffiliateSummary>();
	for (const promo of promoCodes) {
		const code = normalizeCode(promo.code);
		const commissionPercentage = normalizePercentage(promo.commissionPercentage);
		if (!code || commissionPercentage <= 0) continue;
		summaries.set(code, {
			code,
			affiliateName: String(promo.affiliateName ?? '').trim() || code,
			commissionPercentage,
			usageCount: 0,
			paidUsageCount: 0,
			grossOrderAmount: 0,
			commissionableRevenue: 0,
			totalCommission: 0,
			pendingCommission: 0,
			orders: [],
		});
	}

	for (const order of orders) {
		const rawPaymentStatus = String(order.paymentStatus ?? '').toLowerCase();
		if (['failed', 'cancelled', 'canceled', 'refunded'].includes(rawPaymentStatus)) continue;
		if (monthInTimeZone(order.createdAt, timeZone) !== month) continue;

		const storedSnapshot = snapshotFromOrder(order);
		const promoCode = normalizeCode(order.promoCode);
		const snapshot = storedSnapshot ?? createAffiliateCommissionSnapshot(promosByCode.get(promoCode), order);
		if (!snapshot) continue;

		const orderCommission: AffiliateOrderCommission = {
			...snapshot,
			orderNumber: String(order.orderNumber ?? order.id ?? ''),
			createdAt: String(order.createdAt ?? ''),
			customerName: customerName(order),
			orderTotal: money(numberFrom(order.total)),
			paymentStatus: rawPaymentStatus === 'paid' ? 'paid' : 'pending',
		};
		const existing = summaries.get(snapshot.code) ?? {
			code: snapshot.code,
			affiliateName: snapshot.affiliateName,
			commissionPercentage: snapshot.commissionPercentage,
			usageCount: 0,
			paidUsageCount: 0,
			grossOrderAmount: 0,
			commissionableRevenue: 0,
			totalCommission: 0,
			pendingCommission: 0,
			orders: [],
		};
		if (existing.usageCount === 0) {
			existing.affiliateName = snapshot.affiliateName;
			existing.commissionPercentage = snapshot.commissionPercentage;
		}
		existing.usageCount += 1;
		if (orderCommission.paymentStatus === 'paid') existing.paidUsageCount += 1;
		existing.grossOrderAmount = money(existing.grossOrderAmount + orderCommission.orderTotal);
		existing.commissionableRevenue = money(existing.commissionableRevenue + snapshot.commissionableAmount);
		if (orderCommission.paymentStatus === 'paid') {
			existing.totalCommission = money(existing.totalCommission + snapshot.commissionAmount);
		} else {
			existing.pendingCommission = money(existing.pendingCommission + snapshot.commissionAmount);
		}
		existing.orders.push(orderCommission);
		summaries.set(snapshot.code, existing);
	}

	const affiliates = Array.from(summaries.values())
		.map((summary) => ({ ...summary, orders: summary.orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }))
		.sort((a, b) => b.totalCommission + b.pendingCommission - (a.totalCommission + a.pendingCommission) || a.code.localeCompare(b.code));

	return {
		month,
		timeZone,
		usageCount: affiliates.reduce((sum, affiliate) => sum + affiliate.usageCount, 0),
		paidUsageCount: affiliates.reduce((sum, affiliate) => sum + affiliate.paidUsageCount, 0),
		grossOrderAmount: money(affiliates.reduce((sum, affiliate) => sum + affiliate.grossOrderAmount, 0)),
		commissionableRevenue: money(affiliates.reduce((sum, affiliate) => sum + affiliate.commissionableRevenue, 0)),
		totalCommission: money(affiliates.reduce((sum, affiliate) => sum + affiliate.totalCommission, 0)),
		pendingCommission: money(affiliates.reduce((sum, affiliate) => sum + affiliate.pendingCommission, 0)),
		affiliates,
	};
}
