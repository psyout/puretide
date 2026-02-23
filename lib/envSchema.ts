/**
 * Optional env validation. Use at deploy time or in scripts to fail fast when required vars are missing.
 * Does not run automatically at app startup.
 */

export type EnvCheck = { key: string; required: boolean; message?: string };

const CHECKS: EnvCheck[] = [
	{ key: 'DIGIPAY_SITE_ID', required: false, message: 'Required for credit card checkout' },
	{ key: 'DIGIPAY_ENCRYPTION_KEY', required: false, message: 'Required for credit card checkout' },
	{ key: 'GOOGLE_SHEET_ID', required: false, message: 'Required for products/promos/clients from Sheets' },
	{ key: 'SMTP_HOST', required: false, message: 'Required for contact form and order emails' },
];

export type EnvValidationResult = { valid: true } | { valid: false; errors: string[] };

export function validateEnv(): EnvValidationResult {
	const errors: string[] = [];
	for (const { key, required, message } of CHECKS) {
		const value = process.env[key];
		if (required && (value === undefined || String(value).trim() === '')) {
			errors.push(`${key} is required${message ? ` (${message})` : ''}`);
		}
	}
	return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Call in scripts or deploy to throw if validation fails.
 */
export function assertEnv(): void {
	const result = validateEnv();
	if (!result.valid) {
		throw new Error(`Env validation failed:\n${result.errors.join('\n')}`);
	}
}
