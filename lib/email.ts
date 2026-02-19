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
export async function sendLowStockAlert(
	items: Array<{ name: string; slug: string; stock: number }>,
	smtpConfig?: SmtpConfig | null
) {
	if (items.length === 0) return;
	
	const config = smtpConfig ?? getSmtpConfig('ORDER');
	if (!config) return;

	const transporter = createTransporter(config);
	const alertEmail = process.env.LOW_STOCK_EMAIL ?? DEFAULT_ALERT_EMAIL;

	const lines = items.map((item) => `- ${item.name} (${item.slug}): ${item.stock}`);
	const text = `Low stock alert (<= ${LOW_STOCK_THRESHOLD})\n\n${lines.join('\n')}`;

	await transporter.sendMail({
		from: config.from,
		to: alertEmail,
		subject: 'Low stock alert',
		text,
		replyTo: config.replyTo ?? config.from,
		bcc: config.bcc,
	});
}

export type SendMailOptions = {
	to: string;
	subject: string;
	text: string;
	html: string;
	replyTo?: string;
	bcc?: string;
	from?: string;
};

/**
 * Send a single email (e.g. order confirmation). Uses ORDER SMTP config if available.
 */
export async function sendMail(options: SendMailOptions): Promise<{ sent: boolean; error?: string }> {
	const config = getSmtpConfig('ORDER');
	if (!config) {
		return { sent: false, error: 'SMTP not configured' };
	}
	const transporter = createTransporter(config);
	const from = options.from ?? config.from;
	try {
		await transporter.sendMail({
			from,
			to: options.to,
			subject: options.subject,
			text: options.text,
			html: options.html,
			replyTo: options.replyTo ?? config.replyTo ?? config.from,
			bcc: options.bcc ?? config.bcc,
		});
		return { sent: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return { sent: false, error: message };
	}
}
