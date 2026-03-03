import crypto from 'crypto';

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret(): string | undefined {
	return process.env.ORDER_CONFIRMATION_SECRET ?? process.env.DASHBOARD_SECRET;
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
