const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type Entry = { orderNumber: string; orderId?: string; redirectUrl?: string; createdAt: number };

const store = new Map<string, Entry>();

function prune() {
	const now = Date.now();
	Array.from(store.entries()).forEach(([key, entry]) => {
		if (now - entry.createdAt > TTL_MS) store.delete(key);
	});
}

export function getIdempotencyKey(request: Request, body?: { idempotencyKey?: string }): string | null {
	const header = request.headers.get('idempotency-key')?.trim();
	if (header) return header;
	const key = body?.idempotencyKey?.trim();
	if (key) return key;
	return null;
}

export function getCachedOrder(key: string): { orderNumber: string; orderId: string } | null {
	prune();
	const entry = store.get(key);
	if (!entry || !entry.orderId) return null;
	if (Date.now() - entry.createdAt > TTL_MS) {
		store.delete(key);
		return null;
	}
	return { orderNumber: entry.orderNumber, orderId: entry.orderId };
}

export function getCachedDigipay(key: string): { orderNumber: string; redirectUrl: string } | null {
	prune();
	const entry = store.get(key);
	if (!entry || !entry.redirectUrl) return null;
	if (Date.now() - entry.createdAt > TTL_MS) {
		store.delete(key);
		return null;
	}
	return { orderNumber: entry.orderNumber, redirectUrl: entry.redirectUrl };
}

export function setCachedOrder(key: string, orderNumber: string, orderId: string): void {
	prune();
	store.set(key, { orderNumber, orderId, createdAt: Date.now() });
}

export function setCachedDigipay(key: string, orderNumber: string, redirectUrl: string): void {
	prune();
	store.set(key, { orderNumber, redirectUrl, createdAt: Date.now() });
}
