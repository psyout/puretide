import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rateLimit';

type AffiliateApplicationPayload = {
	name?: string;
	email?: string;
	location?: string;
	platforms?: string[];
	handle?: string;
	audienceSize?: string;
	preferredCode?: string;
	about?: string;
	website?: string;
	agreed?: boolean;
};

const ALLOWED_PLATFORMS = new Set(['Instagram', 'TikTok', 'YouTube', 'X', 'Facebook', 'Podcast', 'Website / blog', 'Other']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string) {
	return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);
}

function clean(value: unknown, maxLength: number) {
	return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export async function POST(request: Request) {
	try {
		const { allowed } = checkRateLimit(request, 'affiliate-application', 3, 60 * 60 * 1000);
		if (!allowed) return NextResponse.json({ ok: false, error: 'Too many requests. Please try again later.' }, { status: 429 });

		const payload = (await request.json()) as AffiliateApplicationPayload;
		if (clean(payload.website, 200)) return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });

		const name = clean(payload.name, 100);
		const email = clean(payload.email, 254).toLowerCase();
		const location = clean(payload.location, 120);
		const handle = clean(payload.handle, 200);
		const audienceSize = clean(payload.audienceSize, 50);
		const preferredCode = clean(payload.preferredCode, 24).toUpperCase();
		const about = clean(payload.about, 1500);
		const platforms = Array.isArray(payload.platforms) ? Array.from(new Set(payload.platforms.filter((item): item is string => typeof item === 'string' && ALLOWED_PLATFORMS.has(item)))).slice(0, 8) : [];

		if (!name || !email || !handle || !about || platforms.length === 0 || payload.agreed !== true) return NextResponse.json({ ok: false, error: 'Please complete all required fields.' }, { status: 400 });
		if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 });
		if (preferredCode && !/^[A-Z0-9_-]+$/.test(preferredCode)) return NextResponse.json({ ok: false, error: 'Preferred code contains unsupported characters.' }, { status: 400 });

		const rows = [
			['Name', name], ['Email', email], ['City / region', location || 'Not provided'], ['Platforms', platforms.join(', ')],
			['Main handle / channel', handle], ['Audience size', audienceSize || 'Not provided'], ['Preferred code', preferredCode || 'Not provided'],
			['Confirmed 19+ and guidelines', 'Yes'],
		] as const;
		const text = ['New Pure Tide affiliate application', '', ...rows.map(([label, value]) => `${label}: ${value}`), '', 'Why they are a good fit:', about].join('\n');
		const htmlRows = rows.map(([label, value]) => `<tr><td style="padding:8px 12px 8px 0;color:#60706f;vertical-align:top"><strong>${escapeHtml(label)}</strong></td><td style="padding:8px 0;vertical-align:top">${escapeHtml(value)}</td></tr>`).join('');
		const html = `<div style="font-family:Arial,sans-serif;color:#173238"><h2>New Pure Tide affiliate application</h2><table style="border-collapse:collapse">${htmlRows}</table><h3 style="margin-top:24px">Why they are a good fit</h3><p style="white-space:pre-wrap">${escapeHtml(about)}</p></div>`;
		const safeName = name.replace(/[\r\n\x00-\x1f\x7f]/g, '').slice(0, 100);

		const result = await sendMail({
			to: process.env.AFFILIATE_APPLICATION_TO ?? 'info@puretide.ca',
			from: process.env.CONTACT_FROM ?? 'info@puretide.ca',
			smtpPrefix: 'CONTACT',
			subject: `Affiliate application — ${safeName}`,
			text,
			html,
			replyTo: `${safeName} <${email}>`,
		});

		if (!result.sent) throw new Error(result.error || 'Affiliate application email failed');
		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error('Failed to submit affiliate application', error);
		return NextResponse.json({ ok: false, error: 'We could not submit your application right now.' }, { status: 500 });
	}
}
