import nodemailer from 'nodemailer';
import { LOW_STOCK_THRESHOLD, DEFAULT_ALERT_EMAIL } from './constants';

export type SmtpConfig = {
	host: string;
	port: number;
	user: string;
	pass: string;
	from: string;
	replyTo?: string;
	bcc?: string;
	secure: boolean;
};

/**
 * Get SMTP configuration from environment variables
 * Supports prefix overrides (e.g., ORDER_SMTP_HOST, CONTACT_SMTP_HOST)
 */
export function getSmtpConfig(prefix?: string): SmtpConfig | null {
	const envPrefix = prefix ? `${prefix}_` : '';

	const host = process.env[`${envPrefix}SMTP_HOST`] ?? process.env.SMTP_HOST;
	const portStr = process.env[`${envPrefix}SMTP_PORT`] ?? process.env.SMTP_PORT;
	const port = portStr ? Number(portStr) : undefined;
	const user = process.env[`${envPrefix}SMTP_USER`] ?? process.env.SMTP_USER;
	const pass = process.env[`${envPrefix}SMTP_PASS`] ?? process.env.SMTP_PASS;
	const from = process.env[`${envPrefix}FROM`] ?? process.env.SMTP_FROM;
	const replyTo = process.env.SMTP_REPLY_TO;
	const bcc = process.env.SMTP_BCC;
	const secureEnv = process.env[`${envPrefix}SMTP_SECURE`] ?? process.env.SMTP_SECURE;
	const secure = secureEnv === 'true';

	if (!host || !port || !user || !pass || !from) {
		return null;
	}

	return { host, port, user, pass, from, replyTo, bcc, secure };
}

/**
 * Create a nodemailer transporter from SMTP config
 */
export function createTransporter(config: SmtpConfig) {
	return nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: config.secure,
		auth: {
			user: config.user,
			pass: config.pass,
		},
	});
}

/**
 * Send a low stock alert email
 */
export async function sendLowStockAlert(items: Array<{ name: string; slug: string; stock: number }>) {
	if (items.length === 0) return;

	const alertEmail = process.env.LOW_STOCK_EMAIL ?? DEFAULT_ALERT_EMAIL;
	const from = process.env.LOW_STOCK_FROM;

	const lines = items.map((item) => `- ${item.name} (${item.slug}): ${item.stock}`);
	const text = `Low stock alert (<= ${LOW_STOCK_THRESHOLD})\n\n${lines.join('\n')}`;
	const html = `<p><strong>Low stock alert (<= ${LOW_STOCK_THRESHOLD})</strong></p><ul>${lines.map((line) => `<li>${line}</li>`).join('')}</ul>`;

	const result = await sendMail({
		to: alertEmail,
		from,
		smtpPrefix: 'LOW_STOCK',
		subject: 'Low stock alert',
		text,
		html,
	});

	if (!result.sent) {
		throw new Error(`Low stock alert failed: ${result.error}`);
	}
}

export type SendMailOptions = {
	to: string;
	subject: string;
	text: string;
	html: string;
	replyTo?: string;
	bcc?: string;
	from?: string;
	smtpPrefix?: string;
};

/**
 * Send a single email (e.g. order confirmation). Uses Zoho Mail SMTP for all emails.
 */
export async function sendMail(options: SendMailOptions): Promise<{ sent: boolean; error?: string }> {
	const smtpPrefix = options.smtpPrefix ?? 'ORDER';
	const config = getSmtpConfig(smtpPrefix);

	// Check SMTP configuration
	if (!config) {
		const error = 'SMTP not configured - check environment variables';
		console.error(`❌ Email delivery failed to ${options.to}: ${error}`);
		console.error(`   Subject: ${options.subject}`);
		console.error(`   ⚠️  CRITICAL: Configure SMTP settings (Zoho Mail) to enable email delivery`);
		return { sent: false, error };
	}

	// Send via Zoho Mail SMTP
	const transporter = createTransporter(config);
	const from = options.from ?? config.from;
	try {
		const info = await transporter.sendMail({
			from,
			to: options.to,
			subject: options.subject,
			text: options.text,
			html: options.html,
			replyTo: options.replyTo ?? config.replyTo ?? config.from,
			bcc: options.bcc,
		});
		const accepted = (info.accepted ?? []).map(String).map((address) => address.toLowerCase());
		const recipient = options.to.trim().toLowerCase();
		if (!accepted.includes(recipient)) {
			const rejected = (info.rejected ?? []).map(String).join(', ') || options.to;
			const error = `SMTP server did not accept recipient: ${rejected}`;
			console.error(`❌ Zoho Mail SMTP delivery rejected for ${options.to}: ${error}`);
			return { sent: false, error };
		}
		console.log(`✅ Email sent via Zoho Mail SMTP to ${options.to}`);
		return { sent: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		console.error(`❌ Zoho Mail SMTP delivery failed to ${options.to}:`, message);
		console.error(`   Subject: ${options.subject}`);
		console.error(`   SMTP Host: ${config.host}:${config.port}`);
		console.error(`   SMTP User: ${config.user}`);
		if (message.includes('authentication')) {
			console.error(`   ⚠️  Authentication failed - verify Zoho Mail credentials`);
			console.error(`   💡 Check SMTP_USER and SMTP_PASS in .env file`);
		}
		return { sent: false, error: message };
	} finally {
		transporter.close();
	}
}
