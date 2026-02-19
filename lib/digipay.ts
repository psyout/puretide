import crypto from 'crypto';

const DIGIPAY_BASE_URL = 'https://secure.digipay.co/order/creditcard/cc_form_enc.php';

const ENCRYPT_METHOD = 'aes-256-cbc';
const PBKDF2_ITERATIONS = 999;
const IV_LENGTH = 16;
const SALT_LENGTH = 256;
const KEY_LENGTH = 32; // 256-bit key

/**
 * Encrypt a string using AES-256-CBC with PBKDF2 key derivation (DigiPay spec).
 */
export function digipayEncrypt(plaintext: string, encryptionKey: string): string {
	if (!encryptionKey) {
		throw new Error('DigiPay encryption key is missing');
	}

	const iv = crypto.randomBytes(IV_LENGTH);
	const salt = crypto.randomBytes(SALT_LENGTH);

	const key = crypto.pbkdf2Sync(encryptionKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');

	const cipher = crypto.createCipheriv(ENCRYPT_METHOD, key, iv);

	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

	const payload = {
		ciphertext: encrypted.toString('base64'),
		iv: iv.toString('hex'),
		salt: salt.toString('hex'),
		iterations: PBKDF2_ITERATIONS,
	};

	return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export type DigipayPaymentParams = {
	siteId: string;
	chargeAmount: number | string;
	orderDescription: string;
	session: string;
	pburl: string;
	tcomplete: string;
	shipped?: boolean; // true = physical, false = digital (default)
	firstName?: string;
	lastName?: string;
	email?: string;
	address?: string;
	city?: string;
	state?: string;
	zip?: string;
	country?: string;
};

/**
 * Build the encrypted redirect URL for DigiPay payment page.
 */
export function buildDigipayPaymentUrl(params: DigipayPaymentParams, encryptionKey: string): string {
	const normalizedChargeAmount = Number(params.chargeAmount).toFixed(2);

	const query = new URLSearchParams({
		site_id: params.siteId,
		charge_amount: normalizedChargeAmount,
		type: 'purchase',
		order_description: params.orderDescription.trim().slice(0, 255),
		session: params.session,
		encrypt: '1',
		pburl: params.pburl,
		tcomplete: params.tcomplete,
		shipped: params.shipped ? '1' : '0',
	});

	if (params.firstName) query.set('first_name', params.firstName);
	if (params.lastName) query.set('last_name', params.lastName);
	if (params.email) query.set('email', params.email);
	if (params.address) query.set('address', params.address);
	if (params.city) query.set('city', params.city);
	if (params.state) query.set('state', params.state);
	if (params.zip) query.set('zip', params.zip.replace(/\s/g, ''));

	if (params.country) {
		query.set('country', params.country.toUpperCase().slice(0, 2));
	}

	const fullUrl = `${DIGIPAY_BASE_URL}?${query.toString()}`;
	const encrypted = digipayEncrypt(fullUrl, encryptionKey);

	return `${DIGIPAY_BASE_URL}?param=${encodeURIComponent(encrypted)}`;
}
