import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rateLimit';
import { buildBrandedEmail, emailInfoBox, escapeEmailHtml } from '@/lib/emailTemplate';

type ContactPayload = {
	name: string;
	email: string;
	message: string;
	website?: string;
};

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

		const safeName = sanitizeForEmailSubject(name);
		const subject = `New contact message from ${safeName}`;
		const text = ['New contact form submission', '', `Name: ${name}`, `Email: ${email}`, '', 'Message:', message].join('\n');
		const html = buildBrandedEmail({
			title: 'New contact form submission',
			headerLabel: 'Website notification',
			status: 'New message',
			preheader: `Message from ${safeName}`,
			bodyHtml: `${emailInfoBox(`<strong>Name:</strong> ${escapeEmailHtml(name)}<br><strong>Email:</strong> <a href="mailto:${escapeEmailHtml(email)}" style="color:#1e5260">${escapeEmailHtml(email)}</a>`)}<h2 style="margin:24px 0 10px;color:#1e5260;font-size:18px">Message</h2><p style="margin:0;white-space:pre-line">${escapeEmailHtml(message)}</p>`,
		});

		const result = await sendMail({
			to: 'info@puretide.ca',
			from: process.env.CONTACT_FROM ?? 'info@puretide.ca',
			smtpPrefix: 'CONTACT',
			subject,
			text,
			html,
			replyTo: `${safeName} <${email}>`,
		});

		if (!result.sent) {
			throw new Error(result.error || 'Failed to send contact message');
		}

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error('Failed to send contact message', error);
		return NextResponse.json({ ok: false, error: 'Failed to send message.' }, { status: 500 });
	}
}
