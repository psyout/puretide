import { getIdempotencyEntry, setIdempotencyEntry, deleteExpiredIdempotencyEntries } from './ordersDb';

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getIdempotencyKey(request: Request, body?: { idempotencyKey?: string }): string | null {
	const header = request.headers.get('idempotency-key')?.trim();
	if (header) return header;
	const key = body?.idempotencyKey?.trim();
	if (key) return key;
	return null;
}

export async function getCachedOrder(key: string): Promise<{ orderNumber: string; orderId: string } | null> {
	await deleteExpiredIdempotencyEntries();
	const entry = await getIdempotencyEntry(key, 'orders');
	if (!entry || !entry.orderId) return null;
	return { orderNumber: entry.orderNumber, orderId: entry.orderId };
}

export async function getCachedDigipay(key: string): Promise<{ orderNumber: string; redirectUrl: string } | null> {
	await deleteExpiredIdempotencyEntries();
	const entry = await getIdempotencyEntry(key, 'digipay:create');
	if (!entry || !entry.redirectUrl) return null;
	return { orderNumber: entry.orderNumber, redirectUrl: entry.redirectUrl };
}

export async function setCachedOrder(key: string, orderNumber: string, orderId: string): Promise<void> {
	const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
	await setIdempotencyEntry({
		key,
		route: 'orders',
		orderNumber,
		orderId,
		expiresAt,
	});
}

export async function setCachedDigipay(key: string, orderNumber: string, redirectUrl: string): Promise<void> {
	const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
	await setIdempotencyEntry({
		key,
		route: 'digipay:create',
		orderNumber,
		redirectUrl,
		expiresAt,
	});
}
