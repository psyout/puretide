import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { readSheetProducts } from '@/lib/stockSheet';
import type { Product } from '@/types/product';

const LOW_STOCK_THRESHOLD = 5;
const ALERT_EMAIL = process.env.LOW_STOCK_EMAIL ?? 'info@puretide.ca';

type SmtpConfig = {
	host: string;
	port: number;
	user: string;
	pass: string;
	from: string;
	replyTo?: string;
	bcc?: string;
	secure: boolean;
};

const getSmtpConfig = (): SmtpConfig | null => {
	const host = process.env.ORDER_SMTP_HOST ?? process.env.SMTP_HOST;
	const port = process.env.ORDER_SMTP_PORT
		? Number(process.env.ORDER_SMTP_PORT)
		: process.env.SMTP_PORT
			? Number(process.env.SMTP_PORT)
			: undefined;
	const user = process.env.ORDER_SMTP_USER ?? process.env.SMTP_USER;
	const pass = process.env.ORDER_SMTP_PASS ?? process.env.SMTP_PASS;
	const from = process.env.ORDER_FROM ?? process.env.SMTP_FROM;
	const replyTo = process.env.SMTP_REPLY_TO;
	const bcc = process.env.SMTP_BCC;
	const secure =
		process.env.ORDER_SMTP_SECURE === 'true' ||
		(process.env.ORDER_SMTP_SECURE == null && process.env.SMTP_SECURE === 'true');

	if (!host || !port || !user || !pass || !from) {
		return null;
	}

	return { host, port, user, pass, from, replyTo, bcc, secure };
};

const sendLowStockAlert = async (items: Product[]) => {
	if (items.length === 0) {
		return;
	}
	const smtpConfig = getSmtpConfig();
	if (!smtpConfig) {
		throw new Error('SMTP not configured');
	}

	const transporter = nodemailer.createTransport({
		host: smtpConfig.host,
		port: smtpConfig.port,
		secure: smtpConfig.secure,
		auth: {
			user: smtpConfig.user,
			pass: smtpConfig.pass,
		},
	});

	const lines = items.map((item) => `- ${item.name} (${item.slug}): ${item.stock}`);
	const text = `Low stock alert (<= ${LOW_STOCK_THRESHOLD})\n\n${lines.join('\n')}`;

	await transporter.sendMail({
		from: smtpConfig.from,
		to: ALERT_EMAIL,
		subject: 'Low stock alert',
		text,
		replyTo: smtpConfig.replyTo ?? smtpConfig.from,
		bcc: smtpConfig.bcc,
	});
};

export async function POST() {
	try {
		const items = await readSheetProducts();
		const lowStock = items.filter((item) => item.stock <= LOW_STOCK_THRESHOLD);
		await sendLowStockAlert(lowStock);
		return NextResponse.json({ ok: true, count: lowStock.length });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to send alert';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
