import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';
import {
	createOrdersDbAttributionRepository,
	getOrderByAttributionRefFromDb,
	getOrderBySessionFromDb,
	listPendingAttributionOrders,
	markAttributionTaskDelivered,
	type StoredOrder,
} from './ordersDb';
import { createAttributionIntegration } from '@/vendor/puretide-order-attribution/index.js';

const CONSENT_COOKIE = '__Host-puretide_analytics_consent';
const ATTRIBUTION_COOKIE = '__Host-order_attribution';
const HEX_64 = /^[a-f0-9]{64}$/;

type AttributionSdk = ReturnType<typeof createAttributionIntegration>;

declare global {
	// eslint-disable-next-line no-var
	var __orderAttributionSdk: AttributionSdk | null | undefined;
}

function configured(): boolean {
	return String(process.env.ATTRIBUTION_ENABLED ?? '').toLowerCase() === 'true';
}

function consentSignature(allowed: boolean, secret: string): string {
	return createHmac('sha256', Buffer.from(secret, 'hex'))
		.update(`order-attribution/v1/analytics-consent\0${allowed ? '1' : '0'}`)
		.digest('hex');
}

function parseCookie(cookieHeader: string | null | undefined, name: string): string | null {
	if (!cookieHeader) return null;
	const matches = cookieHeader
		.split(';')
		.map((part) => part.trim())
		.filter((part) => part.startsWith(`${name}=`));
	return matches.length === 1 ? matches[0].slice(name.length + 1) : null;
}

function safeEqualHex(left: string, right: string): boolean {
	if (!HEX_64.test(left) || !HEX_64.test(right)) return false;
	return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function cookieSecret(): string | null {
	const value = String(process.env.ATTRIBUTION_COOKIE_SECRET ?? '');
	return HEX_64.test(value) ? value : null;
}

export function analyticsConsentAllowed(cookieHeader: string | null | undefined): boolean {
	const secret = cookieSecret();
	if (!secret) return false;
	const value = parseCookie(cookieHeader, CONSENT_COOKIE);
	if (!value) return false;
	const [choice, signature] = value.split('.');
	return choice === '1' && safeEqualHex(consentSignature(true, secret), signature ?? '');
}

export function analyticsConsentCookie(allowed: boolean): string {
	const secret = cookieSecret();
	if (!secret) throw new Error('Attribution consent is not configured');
	const maxAge = allowed ? Math.max(1, Number(process.env.ATTRIBUTION_RETENTION_SECONDS ?? 0)) : 31_536_000;
	return `${CONSENT_COOKIE}=${allowed ? '1' : '0'}.${consentSignature(allowed, secret)}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function attributionPublicParameter(): string {
	return String(process.env.ATTRIBUTION_PUBLIC_QUERY_PARAMETER ?? 'binom_click_id');
}

export function attributionUiEnabled(): boolean {
	return configured() && process.env.ATTRIBUTION_ENVIRONMENT === 'qa';
}

export function getOrderAttributionSdk(): AttributionSdk | null {
	if (!configured()) return null;
	if (globalThis.__orderAttributionSdk !== undefined) return globalThis.__orderAttributionSdk;

	const collectorSecret = String(process.env.ATTRIBUTION_COLLECTOR_SECRET ?? '');
	const consentSecret = String(process.env.ATTRIBUTION_COOKIE_SECRET ?? '');
	const orderReferenceSecret = String(process.env.ATTRIBUTION_ORDER_REFERENCE_SECRET ?? '');
	const retentionSeconds = Number(process.env.ATTRIBUTION_RETENTION_SECONDS ?? 0);
	const consentPolicy = String(process.env.ATTRIBUTION_CONSENT_POLICY ?? '');
	const keyId = String(process.env.ATTRIBUTION_KEY_ID ?? '');
	if (
		!HEX_64.test(collectorSecret) ||
		!HEX_64.test(consentSecret) ||
		!HEX_64.test(orderReferenceSecret) ||
		new Set([collectorSecret, consentSecret, orderReferenceSecret]).size !== 3 ||
		!keyId ||
		!consentPolicy ||
		!Number.isInteger(retentionSeconds) ||
		retentionSeconds < 1
	) {
		console.warn('[order-attribution] QA integration is enabled but configuration is incomplete');
		globalThis.__orderAttributionSdk = null;
		return null;
	}

	const loadOrder = async (lookup: { orderId?: string; orderRef?: string }) => {
		const order = lookup.orderId
			? await getOrderBySessionFromDb(lookup.orderId)
			: lookup.orderRef
				? await getOrderByAttributionRefFromDb(lookup.orderRef)
				: null;
		if (!order) return null;
		const createdAtMs = Date.parse(String(order.createdAt ?? ''));
		return {
			id: String(order.id ?? ''),
			committed: true,
			createdAt: Math.floor(createdAtMs / 1000),
			analyticsAllowed: order.analyticsAllowed === true,
			attribution: order.orderAttribution === undefined ? null : order.orderAttribution,
		};
	};

	globalThis.__orderAttributionSdk = createAttributionIntegration({
		environment: process.env.ATTRIBUTION_ENVIRONMENT,
		enabled: true,
		productionEnabled: false,
		storeOrigin: process.env.ATTRIBUTION_STORE_ORIGIN ?? 'https://puretide.ca',
		collectorBaseUrl: process.env.ATTRIBUTION_COLLECTOR_URL ?? 'https://pure-deals.com/wp-json/order-attribution/v1',
		publicQueryParameter: attributionPublicParameter(),
		keyId,
		collectorSecret,
		cookieSecret: consentSecret,
		orderReferenceSecret,
		consentPolicy,
		retentionSeconds,
		repository: createOrdersDbAttributionRepository(),
		analyticsConsent: (context: { allowed?: boolean } | undefined) => context?.allowed === true,
		loadOrder,
		verifyPayment: async () => {
			throw new Error('Payment verification is handled by the existing merchant provider adapters');
		},
	});
	return globalThis.__orderAttributionSdk;
}

export async function captureAttributionVisit(requestUrl: string, cookieHeader: string | null, allowedOverride?: boolean) {
	const sdk = getOrderAttributionSdk();
	if (!sdk) return { ok: true, status: 'disabled', setCookie: null };
	return sdk.captureVisit({ requestUrl, context: { allowed: allowedOverride ?? analyticsConsentAllowed(cookieHeader) } });
}

export async function prepareOrderAttribution(orderId: string, cookieHeader: string | null) {
	const sdk = getOrderAttributionSdk();
	if (!sdk) return { fields: {}, setCookie: null };
	const allowed = analyticsConsentAllowed(cookieHeader);
	const extracted = await sdk.extractOrderAttribution({ cookieHeader: cookieHeader ?? '', context: { allowed } });
	if (!extracted.ok || !extracted.attribution || !allowed) {
		return { fields: { analyticsAllowed: false }, setCookie: extracted.setCookie ?? null };
	}
	return {
		fields: {
			analyticsAllowed: true,
			orderAttributionRef: sdk.orderReference(orderId),
			orderAttribution: extracted.attribution,
			attributionTracking: {
				placedPending: true,
				placedDelivered: false,
				paidPending: false,
				paidDelivered: false,
			},
		},
		setCookie: extracted.setCookie ?? null,
	};
}

function paidEvent(order: StoredOrder): { provider: string; eventId: string } {
	const completion = (order.paymentCompletion as Record<string, unknown> | undefined) ?? {};
	const etransfer = (order.etransfer as Record<string, unknown> | undefined) ?? {};
	const provider = String(order.paymentProvider ?? etransfer.provider ?? order.paymentMethod ?? 'merchant_verified').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
	const eventId = String(completion.transactionId ?? etransfer.lastEventId ?? `${order.id}:${order.paidAt ?? 'paid'}`);
	return { provider: provider || 'merchant_verified', eventId };
}

export async function reconcileOrderAttribution(limit = 50) {
	const sdk = getOrderAttributionSdk();
	if (!sdk) return { ok: true, status: 'disabled', reconciled: 0 };
	const orders = await listPendingAttributionOrders(limit);
	let reconciled = 0;
	for (const order of orders) {
		const id = String(order.id ?? '');
		const orderNumber = String(order.orderNumber ?? '');
		const tracking = (order.attributionTracking as Record<string, unknown> | undefined) ?? {};
		if (!id || !orderNumber) continue;
		if (tracking.placedPending === true) {
			const result = await sdk.recordOrderPlaced(id);
			if (result.ok && !['error', 'disabled'].includes(result.status)) {
				await markAttributionTaskDelivered(orderNumber, 'placed');
				reconciled++;
			}
		}
		if (tracking.paidPending === true && order.paymentStatus === 'paid') {
			const event = paidEvent(order);
			const result = await sdk.recordVerifiedPaid({ orderId: id, ...event });
			if (result.ok && !['error', 'disabled'].includes(result.status)) {
				await markAttributionTaskDelivered(orderNumber, 'paid');
				reconciled++;
			}
		}
	}
	const delivery = await sdk.flush({ limit: Math.max(1, Math.min(limit, 100)) });
	return { ok: true, status: 'processed', reconciled, delivery };
}

export const clearAttributionCookie = `${ATTRIBUTION_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
