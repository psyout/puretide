import crypto from 'crypto';

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret(): string {
	const secret = process.env.ORDER_CONFIRMATION_SECRET;
	if (!secret) {
		if (process.env.NODE_ENV === 'production') {
			throw new Error('ORDER_CONFIRMATION_SECRET environment variable is required in production');
		}
		// Fallback to DASHBOARD_SECRET only in development for backward compatibility
		const fallback = process.env.DASHBOARD_SECRET;
		if (!fallback) {
			// Temporary fallback for development - please set DASHBOARD_SECRET in .env
			console.warn('Neither ORDER_CONFIRMATION_SECRET nor DASHBOARD_SECRET set. Using temporary fallback.');
			return 'temporary-secret-for-development-only';
		}
		console.warn('Using DASHBOARD_SECRET as fallback for ORDER_CONFIRMATION_SECRET. Please set ORDER_CONFIRMATION_SECRET.');
		return fallback;
	}
	return secret;
}

function sign(payload: string, secret: string): string {
	return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function safeEqualHex(leftHex: string, rightHex: string): boolean {
	try {
		const left = Buffer.from(leftHex, 'hex');
		const right = Buffer.from(rightHex, 'hex');
		if (left.length === 0 || right.length === 0 || left.length !== right.length) {
			return false;
		}
		return crypto.timingSafeEqual(left, right);
	} catch {
		return false;
	}
}

export function createOrderConfirmationToken(orderNumber: string, nowMs: number = Date.now(), ttlMs: number = DEFAULT_TTL_MS): string | null {
	const secret = getSecret();
	if (!secret) return null;
	const expiresAt = String(nowMs + ttlMs);
	const payload = `${orderNumber}.${expiresAt}`;
	const signature = sign(payload, secret);
	return `${expiresAt}.${signature}`;
}

export function verifyOrderConfirmationToken(orderNumber: string, token: string | null | undefined, nowMs: number = Date.now()): boolean {
	const secret = getSecret();
	if (!secret || !token) return false;

	const [expiresAtRaw, signature] = token.split('.');
	const expiresAt = Number(expiresAtRaw);
	if (!expiresAtRaw || !signature || !Number.isFinite(expiresAt) || expiresAt < nowMs) {
		return false;
	}

	const expected = sign(`${orderNumber}.${expiresAtRaw}`, secret);
	return safeEqualHex(signature, expected);
}
