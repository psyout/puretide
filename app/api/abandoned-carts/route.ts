import { NextResponse } from 'next/server';
import { ABANDONED_CART_CONSENT_TEXT, getAbandonedCartBusinessIdentity } from '@/lib/abandonedCart';
import { getSmtpConfig } from '@/lib/email';
import { checkRateLimit } from '@/lib/rateLimit';
import {
	getAbandonedCartSettings,
	isAbandonedCartEmailSuppressed,
	updateAbandonedCartStatus,
	upsertAbandonedCart,
} from '@/lib/ordersDb';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CART_ID_RE = /^[a-zA-Z0-9_-]{16,100}$/;

function deploymentEnabled(): boolean {
	return String(process.env.ABANDONED_CART_FEATURE_ENABLED ?? '').toLowerCase() === 'true';
}

export async function GET() {
	if (!deploymentEnabled()) return NextResponse.json({ available: false });
	try {
		const settings = await getAbandonedCartSettings();
		const identity = getAbandonedCartBusinessIdentity();
		const available = settings.enabled && Boolean(getSmtpConfig('ABANDONED_CART'));
		return NextResponse.json({ available, businessAddress: available ? identity.businessAddress : undefined, contactEmail: available ? identity.contactEmail : undefined });
	} catch {
		return NextResponse.json({ available: false });
	}
}

export async function POST(request: Request) {
	const { allowed } = checkRateLimit(request, 'abandoned-cart-capture', 30, 60 * 60 * 1000);
	if (!allowed) return NextResponse.json({ ok: false, error: 'Too many requests.' }, { status: 429 });
	if (!deploymentEnabled()) return NextResponse.json({ ok: false, error: 'Cart reminders are unavailable.' }, { status: 404 });

	try {
		const settings = await getAbandonedCartSettings();
		if (!settings.enabled) return NextResponse.json({ ok: false, error: 'Cart reminders are paused.' }, { status: 409 });
		const identity = getAbandonedCartBusinessIdentity();
		if (!getSmtpConfig('ABANDONED_CART')) return NextResponse.json({ ok: false, error: 'Cart reminders are not configured.' }, { status: 503 });
		const body = (await request.json()) as Record<string, unknown>;
		const id = String(body.id ?? '').trim();
		const email = String(body.email ?? '').trim().toLowerCase();
		const firstName = String(body.firstName ?? '').trim().slice(0, 80);
		const consent = body.consent === true;
		const rawItems = Array.isArray(body.items) ? body.items : [];
		if (!CART_ID_RE.test(id) || !EMAIL_RE.test(email) || !consent || rawItems.length === 0 || rawItems.length > 50) {
			return NextResponse.json({ ok: false, error: 'Invalid cart reminder request.' }, { status: 400 });
		}
		if (await isAbandonedCartEmailSuppressed(email)) {
			return NextResponse.json({ ok: false, error: 'This email is unsubscribed from cart reminders.' }, { status: 409 });
		}
		const items = rawItems
			.map((item) => {
				const value = item as Record<string, unknown>;
				return { id: String(value.id ?? '').trim().slice(0, 160), quantity: Number(value.quantity ?? 0) };
			})
			.filter((item) => item.id && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99);
		if (items.length === 0 || items.length !== rawItems.length) {
			return NextResponse.json({ ok: false, error: 'Invalid cart contents.' }, { status: 400 });
		}
		const now = new Date();
		const sendAfter = new Date(now.getTime() + settings.delayMinutes * 60 * 1000).toISOString();
		const cart = await upsertAbandonedCart({
			id,
			email,
			firstName,
			items,
			consentAt: now.toISOString(),
			consentText: `${ABANDONED_CART_CONSENT_TEXT} Pure Tide, ${identity.businessAddress}. Contact: ${identity.contactEmail}.`,
			sendAfter,
		});
		return NextResponse.json({ ok: true, id: cart.id, status: cart.status, sendAfter: cart.sendAfter });
	} catch (error) {
		console.error('[abandoned-cart:capture] failed', error);
		return NextResponse.json({ ok: false, error: 'Unable to save the cart reminder.' }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const { allowed } = checkRateLimit(request, 'abandoned-cart-cancel', 30, 60 * 60 * 1000);
	if (!allowed) return NextResponse.json({ ok: false, error: 'Too many requests.' }, { status: 429 });
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const id = String(body.id ?? '').trim();
		if (!CART_ID_RE.test(id)) return NextResponse.json({ ok: false, error: 'Invalid cart.' }, { status: 400 });
		await updateAbandonedCartStatus(id, 'suppressed', { lastError: null });
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ ok: false, error: 'Unable to cancel the cart reminder.' }, { status: 500 });
	}
}
