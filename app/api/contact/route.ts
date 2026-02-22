import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { checkRateLimit } from '@/lib/rateLimit';

type ContactPayload = {
	name: string;
	email: string;
	message: string;
	website?: string;
};

function getSmtpConfig() {
	const host = process.env.CONTACT_SMTP_HOST ?? process.env.SMTP_HOST;
	const port = process.env.CONTACT_SMTP_PORT
		? Number(process.env.CONTACT_SMTP_PORT)
		: process.env.SMTP_PORT
			? Number(process.env.SMTP_PORT)
			: undefined;
	const user = process.env.CONTACT_SMTP_USER ?? process.env.SMTP_USER;
	const pass = process.env.CONTACT_SMTP_PASS ?? process.env.SMTP_PASS;
	const from = process.env.CONTACT_FROM ?? process.env.SMTP_FROM;
	const replyTo = process.env.SMTP_REPLY_TO;
	const bcc = process.env.SMTP_BCC;
	const secure =
		process.env.CONTACT_SMTP_SECURE === 'true' ||
		(process.env.CONTACT_SMTP_SECURE == null && process.env.SMTP_SECURE === 'true');

	if (!host || !port || !user || !pass || !from) {
		return null;
	}

	return { host, port, user, pass, from, replyTo, bcc, secure };
}

const CONTACT_RATE_LIMIT = 5;
const CONTACT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_NAME_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 2000;

/** Sanitize for email subject/header use: strip newlines and control chars to avoid header injection */
function sanitizeForEmailSubject(s: string): string {
	return s.replace(/[\r\n\x00-\x1f\x7f]/g, '').slice(0, MAX_NAME_LENGTH);
}

export async function POST(request: Request) {
	try {
		const { allowed } = checkRateLimit(request, 'contact', CONTACT_RATE_LIMIT, CONTACT_WINDOW_MS);
		if (!allowed) {
			return NextResponse.json({ ok: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
		}

		const payload = (await request.json()) as ContactPayload;
		if (typeof payload?.website === 'string' && payload.website.trim() !== '') {
			return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
		}

		const name = payload?.name?.trim();
		const email = payload?.email?.trim();
		const message = payload?.message?.trim();

		if (!name || !email || !message) {
			return NextResponse.json({ ok: false, error: 'Missing required fields.' }, { status: 400 });
		}

		if (name.length > MAX_NAME_LENGTH) {
			return NextResponse.json({ ok: false, error: 'Name is too long.' }, { status: 400 });
		}
		if (message.length > MAX_MESSAGE_LENGTH) {
			return NextResponse.json({ ok: false, error: 'Message is too long.' }, { status: 400 });
		}

		const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailPattern.test(email)) {
			return NextResponse.json({ ok: false, error: 'Invalid email address.' }, { status: 400 });
		}

		const smtpConfig = getSmtpConfig();
		if (!smtpConfig) {
			return NextResponse.json({ ok: false, error: 'Email service is not configured.' }, { status: 500 });
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

		const safeName = sanitizeForEmailSubject(name);
		const subject = `New contact message from ${safeName}`;
		const text = [
			'New contact form submission',
			'',
			`Name: ${name}`,
			`Email: ${email}`,
			'',
			'Message:',
			message,
		].join('\n');

		await transporter.sendMail({
			from: smtpConfig.from,
			to: ['info@puretide.ca'],
			subject,
			text,
			replyTo: `${safeName} <${email}>`,
			bcc: smtpConfig.bcc,
		});

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error('Failed to send contact message', error);
		return NextResponse.json({ ok: false, error: 'Failed to send message.' }, { status: 500 });
	}
}
