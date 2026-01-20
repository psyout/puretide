import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { readSheetProducts } from '@/lib/stockSheet';
import type { Product } from '@/types/product';

const LOW_STOCK_THRESHOLD = 5;
const ALERT_EMAIL = process.env.LOW_STOCK_EMAIL ?? 'info@puretide.ca';
const DEFAULT_COOLDOWN_MINUTES = 60;
const ALERT_STATE_PATH = path.join(process.cwd(), 'data', 'low-stock.json');
const LOW_STOCK_FROM_NAME = process.env.LOW_STOCK_FROM_NAME ?? 'Puretide Low Stock';

const formatLowStockFrom = (value: string, label = LOW_STOCK_FROM_NAME) => {
	const match = value.match(/<([^>]+)>/);
	const address = match ? match[1] : value;
	return `${label} <${address}>`;
};

type AlertState = {
	signature: string;
	sentAt: string;
};

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
	const host = process.env.LOW_STOCK_SMTP_HOST ?? process.env.ORDER_SMTP_HOST ?? process.env.SMTP_HOST;
	const port = process.env.LOW_STOCK_SMTP_PORT
		? Number(process.env.LOW_STOCK_SMTP_PORT)
		: process.env.ORDER_SMTP_PORT
			? Number(process.env.ORDER_SMTP_PORT)
			: process.env.SMTP_PORT
				? Number(process.env.SMTP_PORT)
				: undefined;
	const user = process.env.LOW_STOCK_SMTP_USER ?? process.env.ORDER_SMTP_USER ?? process.env.SMTP_USER;
	const pass = process.env.LOW_STOCK_SMTP_PASS ?? process.env.ORDER_SMTP_PASS ?? process.env.SMTP_PASS;
	const from = process.env.LOW_STOCK_FROM ?? process.env.ORDER_FROM ?? process.env.SMTP_FROM;
	const replyTo = process.env.LOW_STOCK_REPLY_TO ?? process.env.SMTP_REPLY_TO;
	const bcc = process.env.LOW_STOCK_BCC ?? process.env.SMTP_BCC;
	const secure =
		process.env.LOW_STOCK_SMTP_SECURE === 'true' ||
		(process.env.LOW_STOCK_SMTP_SECURE == null &&
			(process.env.ORDER_SMTP_SECURE === 'true' ||
				(process.env.ORDER_SMTP_SECURE == null && process.env.SMTP_SECURE === 'true')));

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
	const fromAddress = process.env.LOW_STOCK_FROM ?? smtpConfig.from;
	const fromWithName = formatLowStockFrom(fromAddress);

	const toAddress = ALERT_EMAIL.trim().toLowerCase();
	const rawBcc = smtpConfig.bcc ?? '';
	const bccList = rawBcc
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
	const filteredBcc = bccList.filter((entry) => entry.toLowerCase() !== toAddress);

	await transporter.sendMail({
		from: fromWithName,
		to: ALERT_EMAIL,
		subject: 'Low stock alert',
		text,
		replyTo: smtpConfig.replyTo ?? smtpConfig.from,
		bcc: filteredBcc.length > 0 ? filteredBcc.join(', ') : undefined,
	});
};

const buildSignature = (items: Product[]) => {
	const normalized = [...items]
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((item) => `${item.id}:${item.stock}`)
		.join('|');
	return crypto.createHash('sha256').update(normalized).digest('hex');
};

const readAlertState = async (): Promise<AlertState | null> => {
	try {
		const contents = await fs.readFile(ALERT_STATE_PATH, 'utf8');
		return JSON.parse(contents) as AlertState;
	} catch {
		return null;
	}
};

const writeAlertState = async (signature: string, sentAt: string) => {
	await fs.mkdir(path.dirname(ALERT_STATE_PATH), { recursive: true });
	await fs.writeFile(ALERT_STATE_PATH, JSON.stringify({ signature, sentAt }), 'utf8');
};

export async function POST() {
	try {
		const items = await readSheetProducts();
		const lowStock = items.filter((item) => item.stock <= LOW_STOCK_THRESHOLD);
		if (lowStock.length === 0) {
			return NextResponse.json({ ok: true, count: 0, skipped: true, reason: 'no-low-stock' });
		}

		const cooldownMinutes = Number(process.env.LOW_STOCK_COOLDOWN_MINUTES ?? DEFAULT_COOLDOWN_MINUTES);
		const now = new Date();
		const signature = buildSignature(lowStock);
		const lastState = await readAlertState();
		if (lastState) {
			const lastSentAt = new Date(lastState.sentAt);
			const minutesSince = (now.getTime() - lastSentAt.getTime()) / 60000;
			if (lastState.signature === signature && minutesSince < cooldownMinutes) {
				return NextResponse.json({
					ok: true,
					count: lowStock.length,
					skipped: true,
					reason: 'cooldown',
				});
			}
		}

		await sendLowStockAlert(lowStock);
		await writeAlertState(signature, now.toISOString());
		return NextResponse.json({ ok: true, count: lowStock.length, skipped: false });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to send alert';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
