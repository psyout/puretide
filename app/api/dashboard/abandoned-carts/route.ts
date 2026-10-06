import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { sendAbandonedCartTest } from '@/lib/abandonedCartProcessor';
import { getSmtpConfig } from '@/lib/email';
import {
	getAbandonedCartSettings,
	listAbandonedCarts,
	updateAbandonedCartSettings,
	updateAbandonedCartStatus,
} from '@/lib/ordersDb';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readiness() {
	return {
		deploymentEnabled: String(process.env.ABANDONED_CART_FEATURE_ENABLED ?? '').toLowerCase() === 'true' && String(process.env.NEXT_PUBLIC_ABANDONED_CART_ENABLED ?? '').toLowerCase() === 'true',
		businessAddressConfigured: Boolean(process.env.ABANDONED_CART_BUSINESS_ADDRESS?.trim()),
		contactEmailConfigured: Boolean((process.env.ABANDONED_CART_CONTACT_EMAIL ?? process.env.ABANDONED_CART_FROM)?.trim()),
		tokenSecretConfigured: Boolean(process.env.ABANDONED_CART_SECRET ?? process.env.DASHBOARD_SECRET),
		smtpConfigured: Boolean(getSmtpConfig('ABANDONED_CART')),
	};
}

export async function GET(request: Request) {
	const unauthorized = requireDashboardAuth(request);
	if (unauthorized) return unauthorized;
	try {
		const [settings, carts] = await Promise.all([getAbandonedCartSettings(), listAbandonedCarts(100)]);
		return NextResponse.json({ ok: true, settings, carts, readiness: readiness() });
	} catch (error) {
		console.error('[dashboard:abandoned-carts:get] failed', error);
		return NextResponse.json({ ok: false, error: 'Failed to load abandoned carts.' }, { status: 500 });
	}
}

export async function PUT(request: Request) {
	const unauthorized = requireDashboardAuth(request);
	if (unauthorized) return unauthorized;
	try {
		const body = (await request.json()) as Record<string, unknown>;
		if (body.enabled === true && Object.values(readiness()).some((value) => !value)) {
			return NextResponse.json({ ok: false, error: 'Complete every readiness check before enabling live reminders.' }, { status: 400 });
		}
		const settings = await updateAbandonedCartSettings({
			enabled: body.enabled === true,
			delayMinutes: Number(body.delayMinutes),
			retentionDays: Number(body.retentionDays),
		});
		return NextResponse.json({ ok: true, settings });
	} catch (error) {
		console.error('[dashboard:abandoned-carts:put] failed', error);
		return NextResponse.json({ ok: false, error: 'Failed to save abandoned-cart settings.' }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const unauthorized = requireDashboardAuth(request);
	if (unauthorized) return unauthorized;
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const action = String(body.action ?? '');
		if (action === 'send-test') {
			const email = String(body.email ?? '').trim().toLowerCase();
			if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: 'Enter a valid test email.' }, { status: 400 });
			await sendAbandonedCartTest(email);
			return NextResponse.json({ ok: true, message: `Test reminder sent to ${email}.` });
		}
		const id = String(body.id ?? '').trim();
		if (!id) return NextResponse.json({ ok: false, error: 'Cart id is required.' }, { status: 400 });
		if (action === 'retry') {
			await updateAbandonedCartStatus(id, 'waiting', { sendAfter: new Date().toISOString(), lastError: null });
			return NextResponse.json({ ok: true, message: 'Cart queued for the next cron run.' });
		}
		if (action === 'suppress') {
			await updateAbandonedCartStatus(id, 'suppressed', { lastError: null });
			return NextResponse.json({ ok: true, message: 'This cart reminder was suppressed.' });
		}
		return NextResponse.json({ ok: false, error: 'Unsupported action.' }, { status: 400 });
	} catch (error) {
		console.error('[dashboard:abandoned-carts:post] failed', error);
		return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Dashboard action failed.' }, { status: 500 });
	}
}
