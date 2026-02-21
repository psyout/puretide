/**
 * In-memory rate limit by IP. No third party; resets on process restart.
 * Use for contact form and checkout to reduce bot/abuse.
 */

function getClientIp(request: Request): string {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) return forwarded.split(',')[0].trim();
	const realIp = request.headers.get('x-real-ip');
	if (realIp) return realIp.trim();
	return '';
}

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 min
let lastCleanup = Date.now();

function cleanup(): void {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
	lastCleanup = now;
	Array.from(store.entries()).forEach(([key, value]) => {
		if (value.resetAt < now) store.delete(key);
	});
}

/**
 * Returns true if the request is allowed, false if rate limited.
 * Call this at the start of the handler; if false, return 429.
 */
export function checkRateLimit(
	request: Request,
	key: string,
	maxRequests: number,
	windowMs: number = WINDOW_MS,
): { allowed: boolean; ip: string } {
	const ip = getClientIp(request);
	if (!ip) return { allowed: true, ip: '' }; // no IP (e.g. server-side) → allow

	const storeKey = `${key}:${ip}`;
	const now = Date.now();
	let entry = store.get(storeKey);

	if (!entry) {
		store.set(storeKey, { count: 1, resetAt: now + windowMs });
		cleanup();
		return { allowed: true, ip };
	}

	if (now >= entry.resetAt) {
		entry = { count: 1, resetAt: now + windowMs };
		store.set(storeKey, entry);
		cleanup();
		return { allowed: true, ip };
	}

	entry.count += 1;
	if (entry.count > maxRequests) {
		return { allowed: false, ip };
	}
	return { allowed: true, ip };
}
