import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { buildOrderEmail } from '@/lib/orderEmail';
import nodemailer from 'nodemailer';

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
	return process.env.ORDER_NOTIFICATION_EMAIL ?? 'info@puretide.ca';
}

async function sendOrderEmail(
	to: string,
	subject: string,
	text: string,
	replyTo?: string,
	bccOverride?: string
): Promise<EmailStatus> {
	const smtpConfig = getSmtpConfig();
	if (!smtpConfig) {
		return { sent: false, skipped: true, error: 'SMTP not configured' };
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

	try {
		await transporter.sendMail({
			from: smtpConfig.from,
			to,
			subject,
			text,
			replyTo: replyTo ?? smtpConfig.replyTo ?? smtpConfig.from,
			bcc: bccOverride ?? smtpConfig.bcc,
		});
		return { sent: true, skipped: false };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown email error';
		return { sent: false, skipped: false, error: message };
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

		const emailData = buildOrderEmail({
			...payload,
			orderNumber,
			createdAt,
		});

		const adminRecipient = getOrderNotificationRecipient();
		const customerEmail = payload.customer.email;
		const customerReplyTo = `${payload.customer.firstName} ${payload.customer.lastName} <${customerEmail}>`;
		const emailStatus = await sendOrderEmail(customerEmail, emailData.subject, emailData.text, undefined, '');
		const adminEmailStatus = await sendOrderEmail(adminRecipient, emailData.subject, emailData.text, customerReplyTo, '');

		existingOrders.push({
			...orderRecord,
			emailPreview: {
				subject: emailData.subject,
				text: emailData.text,
			},
			emailStatus,
			adminEmailStatus,
		});
		await fs.writeFile(ordersFile, JSON.stringify(existingOrders, null, 2), 'utf8');

		return NextResponse.json({ ok: true, orderId: orderRecord.id });
	} catch (error) {
		console.error('Failed to store order', error);
		return NextResponse.json({ ok: false, error: 'Failed to store order' }, { status: 500 });
	}
}
