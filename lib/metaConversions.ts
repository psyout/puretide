import { createHash } from 'crypto';
import type { StoredOrder } from './ordersDb';

const PIXEL_ID = /^\d{5,30}$/;
const GRAPH_VERSION = /^v\d+\.\d+$/;

function enabled(): boolean {
	return String(process.env.META_CAPI_ENABLED ?? '').toLowerCase() === 'true';
}

export function getMetaPixelId(): string | null {
	if (!enabled()) return null;
	const pixelId = String(process.env.META_PIXEL_ID ?? '').trim();
	return PIXEL_ID.test(pixelId) ? pixelId : null;
}

function parseCookie(cookieHeader: string | null, name: string): string | undefined {
	if (!cookieHeader) return undefined;
	const values = cookieHeader
		.split(';')
		.map((part) => part.trim())
		.filter((part) => part.startsWith(`${name}=`));
	if (values.length !== 1) return undefined;
	const value = decodeURIComponent(values[0].slice(name.length + 1)).trim();
	return value && value.length <= 255 ? value : undefined;
}

export function prepareMetaOrderTracking(request: Request): Record<string, unknown> {
	if (!getMetaPixelId()) return {};
	const cookieHeader = request.headers.get('cookie');
	const fbp = parseCookie(cookieHeader, '_fbp');
	const fbc = parseCookie(cookieHeader, '_fbc');
	return {
		metaTracking: {
			enabled: true,
			...(fbp ? { fbp } : {}),
			...(fbc ? { fbc } : {}),
			eventSourceUrl: process.env.APP_BASE_URL?.replace(/\/$/, '') || 'https://puretide.ca',
			purchasePending: false,
			purchaseDelivered: false,
		},
	};
}

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function normalizedEmail(value: unknown): string | null {
	const email = String(value ?? '').trim().toLowerCase();
	return email.includes('@') ? email : null;
}

function normalizedPhone(value: unknown): string | null {
	const phone = String(value ?? '').replace(/\D/g, '');
	return phone.length >= 7 ? phone : null;
}

function safeCode(value: unknown): string {
	const code = String(value ?? 'META_CAPI_ERROR').replace(/[^A-Za-z0-9_.-]/g, '_');
	return code.slice(0, 80) || 'META_CAPI_ERROR';
}

export type MetaDeliveryResult =
	| { ok: true; delivered: true; eventsReceived: number; traceId?: string }
	| { ok: false; delivered: false; retryable: boolean; errorCode: string };

export async function sendMetaPurchase(
	order: StoredOrder,
	fetchImpl: typeof fetch = fetch,
): Promise<MetaDeliveryResult> {
	const pixelId = getMetaPixelId();
	const accessToken = String(process.env.META_CAPI_ACCESS_TOKEN ?? '').trim();
	if (!pixelId || !accessToken) {
		return { ok: false, delivered: false, retryable: false, errorCode: 'META_CAPI_NOT_CONFIGURED' };
	}

	const orderNumber = String(order.orderNumber ?? '').trim();
	if (!orderNumber || order.paymentStatus !== 'paid') {
		return { ok: false, delivered: false, retryable: false, errorCode: 'META_ORDER_NOT_PAID' };
	}

	const customer = (order.customer as Record<string, unknown> | undefined) ?? {};
	const tracking = (order.metaTracking as Record<string, unknown> | undefined) ?? {};
	const email = normalizedEmail(customer.email);
	const phone = normalizedPhone(customer.phone);
	const userData: Record<string, unknown> = {
		external_id: [sha256(`puretide-order:${orderNumber}`)],
	};
	if (email) userData.em = [sha256(email)];
	if (phone) userData.ph = [sha256(phone)];
	if (typeof tracking.fbp === 'string') userData.fbp = tracking.fbp;
	if (typeof tracking.fbc === 'string') userData.fbc = tracking.fbc;

	const paidAt = Date.parse(String(order.paidAt ?? ''));
	const eventTime = Number.isFinite(paidAt) ? Math.floor(paidAt / 1000) : Math.floor(Date.now() / 1000);
	const value = Number(order.total ?? 0);
	const body: Record<string, unknown> = {
		data: [
			{
				event_name: 'Purchase',
				event_time: eventTime,
				event_id: `puretide-purchase-${orderNumber}`,
				action_source: 'website',
				event_source_url:
					typeof tracking.eventSourceUrl === 'string' ? tracking.eventSourceUrl : 'https://puretide.ca',
				user_data: userData,
				custom_data: {
					currency: 'CAD',
					value: Number.isFinite(value) && value >= 0 ? Number(value.toFixed(2)) : 0,
					order_id: orderNumber,
				},
			},
		],
	};
	const testEventCode = String(process.env.META_CAPI_TEST_EVENT_CODE ?? '').trim();
	if (testEventCode) body.test_event_code = testEventCode;

	const configuredVersion = String(process.env.META_GRAPH_API_VERSION ?? 'v24.0').trim();
	const graphVersion = GRAPH_VERSION.test(configuredVersion) ? configuredVersion : 'v24.0';
	try {
		const response = await fetchImpl(`https://graph.facebook.com/${graphVersion}/${pixelId}/events`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(10_000),
		});
		const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
		const received = Number(payload.events_received ?? 0);
		if (!response.ok || received < 1) {
			const apiError = (payload.error as Record<string, unknown> | undefined) ?? {};
			return {
				ok: false,
				delivered: false,
				retryable: response.status === 429 || response.status >= 500,
				errorCode: safeCode(apiError.code ?? `META_HTTP_${response.status}`),
			};
		}
		return {
			ok: true,
			delivered: true,
			eventsReceived: received,
			...(typeof payload.fbtrace_id === 'string' ? { traceId: payload.fbtrace_id } : {}),
		};
	} catch (error) {
		const name = error instanceof Error ? error.name : 'NETWORK';
		return { ok: false, delivered: false, retryable: true, errorCode: safeCode(`META_${name}`) };
	}
}
