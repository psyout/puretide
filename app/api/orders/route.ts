import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { buildOrderEmails } from '@/lib/orderEmail';
import nodemailer from 'nodemailer';
import { readSheetProducts, writeSheetProducts } from '@/lib/stockSheet';

interface OrderPayload {
	customer: {
		firstName: string;
		lastName: string;
		country: string;
		email: string;
		phone: string;
		address: string;
		addressLine2: string;
		city: string;
		province: string;
		zipCode: string;
		orderNotes: string;
	};
	shipToDifferentAddress: boolean;
	shippingAddress?: {
		address: string;
		addressLine2: string;
		city: string;
		province: string;
		zipCode: string;
	};
	shippingMethod: 'regular' | 'express';
	subtotal: number;
	shippingCost: number;
	total: number;
	cartItems: Array<{
		id: number;
		name: string;
		price: number;
		quantity: number;
		image: string;
		description: string;
	}>;
}

async function readOrders(filePath: string) {
	try {
		const contents = await fs.readFile(filePath, 'utf8');
		return JSON.parse(contents) as Array<Record<string, unknown>>;
	} catch (error) {
		const nodeError = error as NodeJS.ErrnoException;
		if (nodeError.code === 'ENOENT') {
			return [];
		}
		throw error;
	}
}

type EmailStatus = {
	sent: boolean;
	skipped: boolean;
	error?: string;
};

const LOW_STOCK_THRESHOLD = 5;
const ALERT_EMAIL = process.env.LOW_STOCK_EMAIL ?? 'info@puretide.ca';

function getSmtpConfig() {
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
}

function getOrderNotificationRecipient() {
	return process.env.ORDER_NOTIFICATION_EMAIL ?? 'orders@puretide.ca';
}

async function sendOrderEmail(
	to: string,
	subject: string,
	text: string,
	html: string,
	replyTo?: string,
	bccOverride?: string,
	fromOverride?: string
): Promise<EmailStatus> {
	const smtpConfig = getSmtpConfig();
	if (!smtpConfig) {
		return { sent: false, skipped: true, error: 'SMTP not configured' };
	}

	const from = fromOverride ?? smtpConfig.from;
	const transporter = nodemailer.createTransport({
		host: smtpConfig.host,
		port: smtpConfig.port,
		secure: smtpConfig.secure,
		auth: {
			user: smtpConfig.user,
			pass: smtpConfig.pass,
		},
	});

	try {
		await transporter.sendMail({
			from,
			to,
			subject,
			text,
			html,
			replyTo: replyTo ?? smtpConfig.replyTo ?? smtpConfig.from,
			bcc: bccOverride ?? smtpConfig.bcc,
		});
		return { sent: true, skipped: false };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown email error';
		return { sent: false, skipped: false, error: message };
	}
}

const formatOrderFrom = (value: string, label = 'Puretide Order Confirmation') => {
	const match = value.match(/<([^>]+)>/);
	const address = match ? match[1] : value;
	return `${label} <${address}>`;
};

async function sendLowStockAlert(items: Array<{ name: string; slug: string; stock: number }>) {
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
}

async function updateSheetStock(items: OrderPayload['cartItems']) {
	try {
		const current = await readSheetProducts();
		const updated = current.map((product) => {
			const match = items.find((item) => String(item.id) === product.id || String(item.id) === product.slug);
			if (!match) {
				return product;
			}
			const nextStock = Math.max(0, product.stock - match.quantity);
			return { ...product, stock: nextStock };
		});

		const lowStock = updated.filter((product) => product.stock <= LOW_STOCK_THRESHOLD);

		await writeSheetProducts(updated);
		await sendLowStockAlert(lowStock);
	} catch (error) {
		console.error('Failed to update stock sheet', error);
	}
}

export async function POST(request: Request) {
	try {
		const payload = (await request.json()) as OrderPayload;
		const ordersDir = path.join(process.cwd(), 'data');
		const ordersFile = path.join(ordersDir, 'orders.json');

		await fs.mkdir(ordersDir, { recursive: true });
		const existingOrders = await readOrders(ordersFile);

		const timestamp = Date.now();
		const orderNumber = `${timestamp}`.slice(-6);
		const createdAt = new Date().toISOString();
		const orderRecord = {
			id: `order_${timestamp}`,
			orderNumber,
			createdAt,
			...payload,
		};

		const emailData = buildOrderEmails({
			...payload,
			orderNumber,
			createdAt,
		});

		const adminRecipient = getOrderNotificationRecipient();
		const customerEmail = payload.customer.email;
		const customerReplyTo = `${payload.customer.firstName} ${payload.customer.lastName} <${customerEmail}>`;
		const smtpConfig = getSmtpConfig();
		const orderFrom = smtpConfig ? formatOrderFrom(smtpConfig.from) : undefined;
		const emailStatus = await sendOrderEmail(
			customerEmail,
			emailData.customer.subject,
			emailData.customer.text,
			emailData.customer.html,
			undefined,
			'',
			orderFrom
		);
		const adminEmailStatus = await sendOrderEmail(
			adminRecipient,
			emailData.admin.subject,
			emailData.admin.text,
			emailData.admin.html,
			customerReplyTo,
			'',
			orderFrom
		);

		existingOrders.push({
			...orderRecord,
			emailPreview: {
				subject: emailData.customer.subject,
				text: emailData.customer.text,
			},
			adminEmailPreview: {
				subject: emailData.admin.subject,
				text: emailData.admin.text,
			},
			emailStatus,
			adminEmailStatus,
		});
		await fs.writeFile(ordersFile, JSON.stringify(existingOrders, null, 2), 'utf8');
		await updateSheetStock(payload.cartItems);

		return NextResponse.json({ ok: true, orderId: orderRecord.id });
	} catch (error) {
		console.error('Failed to store order', error);
		return NextResponse.json({ ok: false, error: 'Failed to store order' }, { status: 500 });
	}
}
