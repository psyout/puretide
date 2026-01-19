import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

type ContactPayload = {
	name: string;
	email: string;
	message: string;
};

function getSmtpConfig() {
	const host = process.env.SMTP_HOST;
	const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
	const user = process.env.SMTP_USER;
	const pass = process.env.SMTP_PASS;
	const from = process.env.SMTP_FROM;
	const replyTo = process.env.SMTP_REPLY_TO;
	const bcc = process.env.SMTP_BCC;
	const secure = process.env.SMTP_SECURE === 'true';
	const contactFrom = process.env.CONTACT_FROM;

	if (!host || !port || !user || !pass || !from) {
		return null;
	}

	return { host, port, user, pass, from, replyTo, bcc, secure, contactFrom };
}

export async function POST(request: Request) {
	try {
		const payload = (await request.json()) as ContactPayload;
		const name = payload?.name?.trim();
		const email = payload?.email?.trim();
		const message = payload?.message?.trim();

		if (!name || !email || !message) {
			return NextResponse.json({ ok: false, error: 'Missing required fields.' }, { status: 400 });
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

		const subject = `New contact message from ${name}`;
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
			from: smtpConfig.contactFrom ?? smtpConfig.from,
			to: 'info@puretide.ca',
			subject,
			text,
			replyTo: `${name} <${email}>`,
			bcc: smtpConfig.bcc,
		});

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error('Failed to send contact message', error);
		return NextResponse.json({ ok: false, error: 'Failed to send message.' }, { status: 500 });
	}
}
