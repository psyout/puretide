import { z } from 'zod';

// Environment variable schema with validation
const envSchema = z.object({
	// Basic Next.js
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

	// Database
	DATABASE_URL: z.string().optional(), // Not used with SQLite but kept for compatibility

	// Google Sheets integration
	GOOGLE_SHEET_ID: z.string().optional(),
	GOOGLE_SHEET_NAME: z.string().optional(),
	GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
	GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),

	// Email (SMTP)
	SMTP_HOST: z.string().optional(),
	SMTP_PORT: z.coerce.number().optional(),
	SMTP_USER: z.string().optional(),
	SMTP_PASS: z.string().optional(),
	DEFAULT_ORDER_NOTIFICATION_EMAIL: z.string().optional(),

	// Resend Email Service
	RESEND_API_KEY: z.string().optional(),

	// Secrets
	DASHBOARD_SECRET: z.string().min(1, 'DASHBOARD_SECRET is required'),
	ORDER_CONFIRMATION_SECRET: z.string().optional(), // Will fallback to DASHBOARD_SECRET in dev
	DIGIPAY_POSTBACK_HMAC_SECRET: z.string().optional(),
	RETRY_JOB_SECRET: z.string().optional(),

	// DigiPay payment
	DIGIPAY_SITE_ID: z.string().optional(),
	DIGIPAY_SECRET_KEY: z.string().optional(),
	DIGIPAY_POSTBACK_ALLOWED_IP: z.string().optional(),

	// Wrike integration
	WRIKE_CLIENT_ID: z.string().optional(),
	WRIKE_CLIENT_SECRET: z.string().optional(),
	WRIKE_REFRESH_TOKEN: z.string().optional(),
	WRIKE_FOLDER_ID: z.string().optional(),

	// Feature flags
	ENABLE_WRIKE_INTEGRATION: z.coerce.boolean().default(false),
	ENABLE_EMAIL_NOTIFICATIONS: z.coerce.boolean().default(true),
	ENABLE_SHEET_SYNC: z.coerce.boolean().default(true),
});

type EnvSchema = z.infer<typeof envSchema>;

let validatedEnv: EnvSchema | null = null;

export function validateEnv(): EnvSchema {
	if (validatedEnv) return validatedEnv;

	try {
		validatedEnv = envSchema.parse(process.env);

		// Production-specific validations
		if (validatedEnv.NODE_ENV === 'production') {
			// In production, ORDER_CONFIRMATION_SECRET is required
			if (!validatedEnv.ORDER_CONFIRMATION_SECRET) {
				throw new Error('ORDER_CONFIRMATION_SECRET is required in production');
			}

			// In production, DigiPay HMAC secret is required if DigiPay is used
			if (validatedEnv.DIGIPAY_SITE_ID && !validatedEnv.DIGIPAY_POSTBACK_HMAC_SECRET) {
				throw new Error('DIGIPAY_POSTBACK_HMAC_SECRET is required in production when using DigiPay');
			}

			// In production, email should be configured for order notifications
			if (validatedEnv.ENABLE_EMAIL_NOTIFICATIONS && !validatedEnv.SMTP_HOST && !validatedEnv.RESEND_API_KEY) {
				console.warn('Neither SMTP_HOST nor RESEND_API_KEY configured - email notifications will be disabled');
			}
		}

		// Development warnings
		if (validatedEnv.NODE_ENV === 'development') {
			if (!validatedEnv.ORDER_CONFIRMATION_SECRET) {
				console.warn('ORDER_CONFIRMATION_SECRET not configured, using DASHBOARD_SECRET as fallback');
			}
			if (!validatedEnv.DIGIPAY_POSTBACK_HMAC_SECRET) {
				console.warn('DIGIPAY_POSTBACK_HMAC_SECRET not configured - webhook HMAC verification will be skipped');
			}
			if (!validatedEnv.RESEND_API_KEY) {
				console.warn('RESEND_API_KEY not configured - will use SMTP fallback for email delivery');
			}
		}

		console.log(`Environment validated for ${validatedEnv.NODE_ENV}`);
		return validatedEnv;
	} catch (error) {
		console.error('Environment validation failed:', error);
		throw new Error(`Invalid environment configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

export function getEnv(): EnvSchema {
	if (!validatedEnv) {
		throw new Error('Environment not validated. Call validateEnv() first.');
	}
	return validatedEnv;
}

// Export individual getters for convenience
export function isProduction(): boolean {
	return getEnv().NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
	return getEnv().NODE_ENV === 'development';
}

export function getEmailConfig() {
	const env = getEnv();
	if (!env.SMTP_HOST) return null;

	return {
		host: env.SMTP_HOST,
		port: env.SMTP_PORT || 587,
		secure: false, // STARTTLS
		auth:
			env.SMTP_USER && env.SMTP_PASS
				? {
						user: env.SMTP_USER,
						pass: env.SMTP_PASS,
					}
				: undefined,
	};
}

export function getGoogleSheetsConfig() {
	const env = getEnv();
	if (!env.GOOGLE_SHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
		return null;
	}

	return {
		sheetId: env.GOOGLE_SHEET_ID,
		sheetName: env.GOOGLE_SHEET_NAME || 'Sheet1',
		clientEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
		privateKey: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
	};
}

export function getDigipayConfig() {
	const env = getEnv();
	if (!env.DIGIPAY_SITE_ID || !env.DIGIPAY_SECRET_KEY) {
		return null;
	}

	return {
		siteId: env.DIGIPAY_SITE_ID,
		secretKey: env.DIGIPAY_SECRET_KEY,
		hmacSecret: env.DIGIPAY_POSTBACK_HMAC_SECRET,
		allowedIps: env.DIGIPAY_POSTBACK_ALLOWED_IP?.split(',')
			.map((ip) => ip.trim())
			.filter(Boolean) || ['185.240.29.227'],
	};
}

export function getWrikeConfig() {
	const env = getEnv();
	if (!env.WRIKE_CLIENT_ID || !env.WRIKE_CLIENT_SECRET || !env.WRIKE_REFRESH_TOKEN) {
		return null;
	}

	return {
		clientId: env.WRIKE_CLIENT_ID,
		clientSecret: env.WRIKE_CLIENT_SECRET,
		refreshToken: env.WRIKE_REFRESH_TOKEN,
		folderId: env.WRIKE_FOLDER_ID,
	};
}
