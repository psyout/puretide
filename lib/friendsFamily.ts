import crypto from 'crypto';
import { checkRateLimit } from '@/lib/rateLimit';
import { consumeFriendsFamilyOtp, getUnconsumedFriendsFamilyOtpByEmail, incrementFriendsFamilyOtpAttempts, insertFriendsFamilyOtpRecord, isFriendsFamilyEmailAllowlisted } from '@/lib/ordersDb';
import { getEnv } from '@/lib/env';

export type PaymentPath = 'manual' | 'bluepeak' | 'manual_friends_family';

export type StartFriendsFamilyOtpResult = {
	ok: true;
	message: string;
	code?: string;
};

export function isFriendsFamilyEnabled(): boolean {
	try {
		return Boolean(getEnv().FRIENDS_FAMILY_ENABLED);
	} catch {
		return String(process.env.FRIENDS_FAMILY_ENABLED ?? '').toLowerCase() === 'true';
	}
}

export function normalizeEmail(raw: string): string {
	return String(raw ?? '')
		.trim()
		.toLowerCase();
}

const OTP_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const OTP_ATTEMPT_LIMIT = 8;

export const FRIENDS_FAMILY_COOKIE_NAME = 'friends_family_session';

function getCookieSecret(): string {
	const secret = process.env.ORDER_CONFIRMATION_SECRET;
	if (secret && secret.trim() !== '') return secret;
	if (process.env.NODE_ENV === 'production') {
		throw new Error('ORDER_CONFIRMATION_SECRET is required for Friends & Family session signing in production');
	}
	const fallback = process.env.DASHBOARD_SECRET;
	if (fallback && fallback.trim() !== '') return fallback;
	return 'temporary-secret-for-development-only';
}

function base64UrlEncodeUtf8(value: string): string {
	return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeUtf8(value: string): string {
	let b64 = value.replace(/-/g, '+').replace(/_/g, '/');
	while (b64.length % 4 !== 0) b64 += '=';
	return Buffer.from(b64, 'base64').toString('utf8');
}

function sign(payload: string, secret: string): string {
	return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

function safeEqualHex(leftHex: string, rightHex: string): boolean {
	try {
		const left = Buffer.from(leftHex, 'hex');
		const right = Buffer.from(rightHex, 'hex');
		if (left.length === 0 || right.length === 0 || left.length !== right.length) return false;
		return crypto.timingSafeEqual(left, right);
	} catch {
		return false;
	}
}

export function createFriendsFamilySessionCookie(email: string, nowMs: number = Date.now()): { name: string; value: string; options: string } {
	const normalizedEmail = normalizeEmail(email);
	const secret = getCookieSecret();
	const expiresAtMs = nowMs + SESSION_TTL_MS;
	const expiresAt = String(expiresAtMs);
	const emailEnc = base64UrlEncodeUtf8(normalizedEmail);
	const payload = `${emailEnc}.${expiresAt}`;
	const signature = sign(payload, secret);
	const value = `${emailEnc}.${expiresAt}.${signature}`;
	const maxAge = Math.floor(SESSION_TTL_MS / 1000);
	const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
	const options = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
	return { name: FRIENDS_FAMILY_COOKIE_NAME, value, options };
}

export function getVerifiedFriendsFamilyEmailFromCookie(cookieHeader: string | null, nowMs: number = Date.now()): string | null {
	if (!cookieHeader) return null;
	const cookies = cookieHeader.split(';').map((c) => c.trim());
	const sessionCookie = cookies.find((c) => c.startsWith(`${FRIENDS_FAMILY_COOKIE_NAME}=`));
	if (!sessionCookie) return null;
	const rawValue = sessionCookie.slice(FRIENDS_FAMILY_COOKIE_NAME.length + 1).trim();
	const [emailEnc, expiresAtRaw, signature] = rawValue.split('.');
	const expiresAt = Number(expiresAtRaw);
	if (!emailEnc || !expiresAtRaw || !signature || !Number.isFinite(expiresAt) || expiresAt < nowMs) return null;
	const secret = getCookieSecret();
	const expected = sign(`${emailEnc}.${expiresAtRaw}`, secret);
	if (!safeEqualHex(signature, expected)) return null;
	try {
		return normalizeEmail(base64UrlDecodeUtf8(emailEnc));
	} catch {
		return null;
	}
}

function getOtpHash(input: { code: string; salt: string }): string {
	const secret = getCookieSecret();
	return crypto.createHash('sha256').update(`${input.code}.${input.salt}.${secret}`, 'utf8').digest('hex');
}

export function generateSixDigitOtp(): string {
	const value = crypto.randomInt(0, 1000000);
	return String(value).padStart(6, '0');
}

const emailRateStore = new Map<string, { count: number; resetAtMs: number }>();

function checkEmailRateLimit(key: string, max: number, windowMs: number): boolean {
	const now = Date.now();
	const entry = emailRateStore.get(key);
	if (!entry || now >= entry.resetAtMs) {
		emailRateStore.set(key, { count: 1, resetAtMs: now + windowMs });
		return true;
	}
	entry.count += 1;
	if (entry.count > max) return false;
	return true;
}

export async function startFriendsFamilyOtp(request: Request, emailRaw: string): Promise<StartFriendsFamilyOtpResult> {
	if (!isFriendsFamilyEnabled()) {
		return { ok: true, message: 'If this email is eligible, a verification code has been sent.' };
	}
	const email = normalizeEmail(emailRaw);

	// Rate limit by IP
	const ipRate = checkRateLimit(request, 'friends-family-otp-start', 10, 60 * 60 * 1000);
	if (!ipRate.allowed) {
		return { ok: true, message: 'If this email is eligible, a verification code has been sent.' };
	}

	// Rate limit by email (non-persistent, additive)
	if (email) {
		const allowedByEmail = checkEmailRateLimit(`ff:start:${email}`, 5, 60 * 60 * 1000);
		if (!allowedByEmail) {
			return { ok: true, message: 'If this email is eligible, a verification code has been sent.' };
		}
	}

	const eligible = email ? await isFriendsFamilyEmailAllowlisted(email) : false;
	if (!eligible) {
		// Non-enumerating behavior
		return { ok: true, message: 'If this email is eligible, a verification code has been sent.' };
	}

	const code = generateSixDigitOtp();
	const salt = crypto.randomBytes(16).toString('hex');
	const otpHash = getOtpHash({ code, salt });
	const nowIso = new Date().toISOString();
	const expiresAtIso = new Date(Date.now() + OTP_TTL_MS).toISOString();

	await insertFriendsFamilyOtpRecord({
		id: crypto.randomUUID(),
		email,
		otpHash,
		salt,
		expiresAt: expiresAtIso,
		attempts: 0,
		createdAt: nowIso,
	});

	return { ok: true, message: 'If this email is eligible, a verification code has been sent.', code };
}

export async function verifyFriendsFamilyOtp(
	request: Request,
	input: { email: string; code: string },
): Promise<{ ok: boolean; error?: string; cookie?: { name: string; value: string; options: string } }> {
	if (!isFriendsFamilyEnabled()) {
		return { ok: false, error: 'Friends & Family is currently unavailable.' };
	}
	const email = normalizeEmail(input.email);
	const code = String(input.code ?? '').trim();

	const ipRate = checkRateLimit(request, 'friends-family-otp-verify', 20, 60 * 60 * 1000);
	if (!ipRate.allowed) {
		return { ok: false, error: 'Too many requests. Please try again later.' };
	}
	if (!email || !/^[0-9]{6}$/.test(code)) {
		return { ok: false, error: 'Invalid verification code.' };
	}

	const eligible = await isFriendsFamilyEmailAllowlisted(email);
	if (!eligible) {
		return { ok: false, error: 'Invalid verification code.' };
	}

	const nowIso = new Date().toISOString();
	const record = await getUnconsumedFriendsFamilyOtpByEmail(email, nowIso);
	if (!record) {
		return { ok: false, error: 'Invalid verification code.' };
	}
	if (record.attempts >= OTP_ATTEMPT_LIMIT) {
		return { ok: false, error: 'Invalid verification code.' };
	}

	const expected = record.otpHash;
	const provided = getOtpHash({ code, salt: record.salt });
	const ok = safeEqualHex(provided, expected);
	if (!ok) {
		await incrementFriendsFamilyOtpAttempts(record.id);
		return { ok: false, error: 'Invalid verification code.' };
	}

	await consumeFriendsFamilyOtp(record.id, new Date().toISOString());
	const cookie = createFriendsFamilySessionCookie(email);
	return { ok: true, cookie };
}

export function decidePaymentPath(input: { etransferProvider: 'manual' | 'bluepeak'; customerEmail: string; verifiedFriendsFamilyEmail: string | null }): PaymentPath {
	const customerEmail = normalizeEmail(input.customerEmail);
	const verified = input.verifiedFriendsFamilyEmail ? normalizeEmail(input.verifiedFriendsFamilyEmail) : null;
	if (verified && customerEmail && verified === customerEmail) {
		return 'manual_friends_family';
	}
	return input.etransferProvider === 'bluepeak' ? 'bluepeak' : 'manual';
}

export function decidePaymentPathWithFeatureFlag(input: { etransferProvider: 'manual' | 'bluepeak'; customerEmail: string; verifiedFriendsFamilyEmail: string | null }): PaymentPath {
	if (!isFriendsFamilyEnabled()) {
		return input.etransferProvider === 'bluepeak' ? 'bluepeak' : 'manual';
	}
	return decidePaymentPath(input);
}

export async function startFriendsFamilyOtpWithDeps(
	request: Request,
	input: { emailRaw: string },
	deps: {
		insertOtp: typeof insertFriendsFamilyOtpRecord;
		isAllowlisted: typeof isFriendsFamilyEmailAllowlisted;
		generateOtp?: () => string;
		now?: () => Date;
	},
): Promise<StartFriendsFamilyOtpResult> {
	if (!isFriendsFamilyEnabled()) {
		return { ok: true, message: 'If this email is eligible, a verification code has been sent.' };
	}

	const email = normalizeEmail(input.emailRaw);
	const now = deps.now ?? (() => new Date());

	const ipRate = checkRateLimit(request, 'friends-family-otp-start', 10, 60 * 60 * 1000);
	if (!ipRate.allowed) {
		return { ok: true, message: 'If this email is eligible, a verification code has been sent.' };
	}
	if (email) {
		const allowedByEmail = checkEmailRateLimit(`ff:start:${email}`, 5, 60 * 60 * 1000);
		if (!allowedByEmail) {
			return { ok: true, message: 'If this email is eligible, a verification code has been sent.' };
		}
	}

	const eligible = email ? await deps.isAllowlisted(email) : false;
	if (!eligible) {
		return { ok: true, message: 'If this email is eligible, a verification code has been sent.' };
	}

	const code = (deps.generateOtp ?? generateSixDigitOtp)();
	const salt = crypto.randomBytes(16).toString('hex');
	const otpHash = getOtpHash({ code, salt });
	const createdAtIso = now().toISOString();
	const expiresAtIso = new Date(now().getTime() + OTP_TTL_MS).toISOString();

	await deps.insertOtp({
		id: crypto.randomUUID(),
		email,
		otpHash,
		salt,
		expiresAt: expiresAtIso,
		attempts: 0,
		createdAt: createdAtIso,
	});

	return { ok: true, message: 'If this email is eligible, a verification code has been sent.', code };
}

export async function verifyFriendsFamilyOtpWithDeps(
	request: Request,
	input: { email: string; code: string },
	deps: {
		isAllowlisted: typeof isFriendsFamilyEmailAllowlisted;
		getOtp: typeof getUnconsumedFriendsFamilyOtpByEmail;
		incAttempts: typeof incrementFriendsFamilyOtpAttempts;
		consumeOtp: typeof consumeFriendsFamilyOtp;
		createCookie: typeof createFriendsFamilySessionCookie;
		now?: () => Date;
	},
): Promise<{ ok: boolean; error?: string; cookie?: { name: string; value: string; options: string } }> {
	if (!isFriendsFamilyEnabled()) {
		return { ok: false, error: 'Friends & Family is currently unavailable.' };
	}

	const email = normalizeEmail(input.email);
	const code = String(input.code ?? '').trim();
	const now = deps.now ?? (() => new Date());

	const ipRate = checkRateLimit(request, 'friends-family-otp-verify', 20, 60 * 60 * 1000);
	if (!ipRate.allowed) {
		return { ok: false, error: 'Too many requests. Please try again later.' };
	}
	if (!email || !/^[0-9]{6}$/.test(code)) {
		return { ok: false, error: 'Invalid verification code.' };
	}

	const eligible = await deps.isAllowlisted(email);
	if (!eligible) {
		return { ok: false, error: 'Invalid verification code.' };
	}

	const record = await deps.getOtp(email, now().toISOString());
	if (!record) {
		return { ok: false, error: 'Invalid verification code.' };
	}
	if (record.attempts >= OTP_ATTEMPT_LIMIT) {
		return { ok: false, error: 'Invalid verification code.' };
	}

	const provided = getOtpHash({ code, salt: record.salt });
	if (!safeEqualHex(provided, record.otpHash)) {
		await deps.incAttempts(record.id);
		return { ok: false, error: 'Invalid verification code.' };
	}

	await deps.consumeOtp(record.id, now().toISOString());
	return { ok: true, cookie: deps.createCookie(email) };
}
