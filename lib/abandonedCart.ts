import crypto from 'crypto';
import type { Product } from '@/types/product';
import type { AbandonedCartItem } from '@/lib/ordersDb';

export const ABANDONED_CART_CONSENT_TEXT =
	'Email me one reminder about items left in my cart. I can unsubscribe at any time.';

export function getAbandonedCartBusinessIdentity(): { businessAddress: string; contactEmail: string } {
	const businessAddress = process.env.ABANDONED_CART_BUSINESS_ADDRESS?.trim();
	const contactEmail = (process.env.ABANDONED_CART_CONTACT_EMAIL ?? process.env.ABANDONED_CART_FROM ?? '').trim();
	if (!businessAddress) throw new Error('ABANDONED_CART_BUSINESS_ADDRESS is required before reminders can be sent.');
	if (!contactEmail) throw new Error('ABANDONED_CART_CONTACT_EMAIL or ABANDONED_CART_FROM is required before reminders can be sent.');
	return { businessAddress, contactEmail };
}

export type AbandonedCartDisplayItem = {
	id: string;
	name: string;
	quantity: number;
	price: number;
	image?: string;
};

export type RecoverableCartItem = Product & { quantity: number };

export function resolveRecoverableCartItems(items: AbandonedCartItem[], products: Product[]): RecoverableCartItem[] {
	const recovered: RecoverableCartItem[] = [];
	for (const item of items) {
		const direct = products.find((product) => product.id === item.id || product.slug === item.id);
		if (direct && (direct.status ?? 'published') === 'published' && direct.stock > 0) {
			recovered.push({ ...direct, quantity: Math.min(item.quantity, direct.stock, 99) });
			continue;
		}
		const base = products.find((product) => product.variants?.some((variant) => variant.key === item.id));
		const variant = base?.variants?.find((entry) => entry.key === item.id);
		if (base && variant && (base.status ?? 'published') === 'published' && variant.stock > 0) {
			recovered.push({
				...base,
				id: variant.key,
				price: variant.price,
				stock: variant.stock,
				mg: variant.label,
				quantity: Math.min(item.quantity, variant.stock, 99),
			});
		}
	}
	return recovered;
}

export function toAbandonedCartDisplayItems(items: RecoverableCartItem[]): AbandonedCartDisplayItem[] {
	return items.map((item) => ({
		id: item.id,
		name: item.mg && !item.name.toLowerCase().includes('stack') ? `${item.name} – ${item.mg}` : item.name,
		quantity: item.quantity,
		price: item.price,
		image: item.image,
	}));
}

function getTokenSecret(): string {
	const secret = process.env.ABANDONED_CART_SECRET ?? process.env.DASHBOARD_SECRET;
	if (!secret) throw new Error('ABANDONED_CART_SECRET or DASHBOARD_SECRET is required');
	return secret;
}

function sign(payload: string, purpose: 'recover' | 'unsubscribe'): string {
	return crypto.createHmac('sha256', getTokenSecret()).update(`${purpose}:${payload}`).digest('base64url');
}

export function createAbandonedCartToken(cartId: string, purpose: 'recover' | 'unsubscribe', expiresAtMs: number): string {
	const payload = `${cartId}.${expiresAtMs}`;
	return `${payload}.${sign(payload, purpose)}`;
}

export function verifyAbandonedCartToken(token: string, purpose: 'recover' | 'unsubscribe', nowMs = Date.now()): { cartId: string; expiresAtMs: number } | null {
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [cartId, expiresRaw, signature] = parts;
	const expiresAtMs = Number(expiresRaw);
	if (!cartId || !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs || !signature) return null;
	const expected = sign(`${cartId}.${expiresRaw}`, purpose);
	const actualBuffer = Buffer.from(signature);
	const expectedBuffer = Buffer.from(expected);
	if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
	return { cartId, expiresAtMs };
}

export function getStoreBaseUrl(): string {
	const raw = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://puretide.ca';
	return raw.replace(/\/$/, '');
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>'"]/g, (character) => {
		const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
		return entities[character] ?? character;
	});
}

export function buildAbandonedCartEmail(input: {
	firstName?: string;
	items: AbandonedCartDisplayItem[];
	recoveryUrl: string;
	unsubscribeUrl: string;
	businessAddress: string;
	contactEmail: string;
}): { subject: string; text: string; html: string } {
	const greeting = input.firstName?.trim() ? `Hi ${input.firstName.trim()},` : 'Hi,';
	const itemLines = input.items.map((item) => `- ${item.name} × ${item.quantity} — $${(item.price * item.quantity).toFixed(2)} CAD`);
	const subtotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
	const subject = 'You left something in your Pure Tide cart';
	const text = [
		greeting,
		'',
		'You asked us to remind you about the items left in your cart:',
		'',
		...itemLines,
		'',
		`Estimated subtotal: $${subtotal.toFixed(2)} CAD`,
		'',
		`Return to your cart: ${input.recoveryUrl}`,
		'',
		'Prices and availability are checked again at checkout.',
		'',
		`Pure Tide · ${input.businessAddress} · ${input.contactEmail}`,
		`Unsubscribe from cart reminders: ${input.unsubscribeUrl}`,
	].join('\n');

	const rows = input.items
		.map(
			(item) => `
				<tr>
					<td style="padding:12px 0;border-bottom:1px solid #dce8e6;color:#173f3b;">${escapeHtml(item.name)} × ${item.quantity}</td>
					<td style="padding:12px 0;border-bottom:1px solid #dce8e6;text-align:right;color:#173f3b;">$${(item.price * item.quantity).toFixed(2)}</td>
				</tr>`,
		)
		.join('');
	const html = `<!doctype html>
	<html><body style="margin:0;background:#f4f7f6;font-family:Arial,sans-serif;color:#173f3b;">
		<div style="max-width:620px;margin:0 auto;padding:32px 18px;">
			<div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #dce8e6;">
				<p style="margin:0 0 18px;font-size:16px;">${escapeHtml(greeting)}</p>
				<h1 style="font-size:26px;line-height:1.2;margin:0 0 12px;color:#0b625b;">Your cart is waiting</h1>
				<p style="line-height:1.6;margin:0 0 20px;">You asked us to remind you about the items left in your Pure Tide cart.</p>
				<table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:20px;">${rows}
					<tr><td style="padding-top:14px;font-weight:700;">Estimated subtotal</td><td style="padding-top:14px;text-align:right;font-weight:700;">$${subtotal.toFixed(2)} CAD</td></tr>
				</table>
				<a href="${escapeHtml(input.recoveryUrl)}" style="display:inline-block;background:#0b625b;color:#fff;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:700;">Return to your cart</a>
				<p style="font-size:12px;line-height:1.5;color:#5d7471;margin:20px 0 0;">Prices, promotions, and availability are checked again at checkout.</p>
			</div>
			<p style="font-size:12px;line-height:1.6;color:#667b78;text-align:center;margin:18px 0 0;">Pure Tide · ${escapeHtml(input.businessAddress)}<br /><a href="mailto:${escapeHtml(input.contactEmail)}" style="color:#0b625b;">${escapeHtml(input.contactEmail)}</a><br /><a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#0b625b;">Unsubscribe from cart reminders</a></p>
		</div>
	</body></html>`;

	return { subject, text, html };
}
