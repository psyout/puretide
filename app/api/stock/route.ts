import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { readSheetProducts, writeSheetProducts } from '@/lib/stockSheet';
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
		return;
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

export async function GET() {
	try {
		const items = await readSheetProducts();
		return NextResponse.json({ ok: true, items });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to read stock';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}

function requireStockApiKey(request: Request): boolean {
	const key = process.env.STOCK_API_KEY;
	if (!key) return false;
	const provided = request.headers.get('x-api-key') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
	return provided === key;
}

function validateStockItems(items: unknown): { valid: true; items: Product[] } | { valid: false; error: string } {
	if (!Array.isArray(items) || items.length === 0) {
		return { valid: false, error: 'items must be a non-empty array.' };
	}
	const MAX_STOCK = 999999;
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (!item || typeof item !== 'object') {
			return { valid: false, error: `items[${i}] must be an object.` };
		}
		if (typeof (item as Product).id !== 'string' || !(item as Product).id.trim()) {
			return { valid: false, error: `items[${i}] must have a non-empty id.` };
		}
		if (typeof (item as Product).slug !== 'string' || !(item as Product).slug.trim()) {
			return { valid: false, error: `items[${i}] must have a non-empty slug.` };
		}
		const stock = Number((item as Product).stock);
		if (Number.isNaN(stock) || stock < 0 || stock > MAX_STOCK) {
			return { valid: false, error: `items[${i}] stock must be a number between 0 and ${MAX_STOCK}.` };
		}
	}
	return { valid: true, items: items as Product[] };
}

export async function POST(request: Request) {
	try {
		if (!requireStockApiKey(request)) {
			return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
		}

		const payload = (await request.json()) as { items?: unknown };
		const itemsPayload = payload?.items ?? [];
		const validation = validateStockItems(itemsPayload);
		if (!validation.valid) {
			return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
		}
		const items = validation.items;

		await writeSheetProducts(items);

		const lowStock = items.filter((item) => Number(item.stock) <= LOW_STOCK_THRESHOLD);

		await sendLowStockAlert(lowStock);

		return NextResponse.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to update stock';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
