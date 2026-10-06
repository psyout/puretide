import { buildAbandonedCartEmail, createAbandonedCartToken, getAbandonedCartBusinessIdentity, getStoreBaseUrl, resolveRecoverableCartItems, toAbandonedCartDisplayItems } from '@/lib/abandonedCart';
import { sendMail } from '@/lib/email';
import {
	claimAbandonedCartForSending,
	deleteExpiredAbandonedCarts,
	getAbandonedCartSettings,
	hasOrderForEmailSince,
	isAbandonedCartEmailSuppressed,
	listAbandonedCarts,
	listDueAbandonedCarts,
	markAbandonedCartsRecoveredByEmail,
	requeueStaleAbandonedCartClaims,
	updateAbandonedCartStatus,
} from '@/lib/ordersDb';
import { readProducts } from '@/lib/productCatalog';

function urls(cartId: string, retentionDays: number) {
	const expiresAt = Date.now() + retentionDays * 24 * 60 * 60 * 1000;
	const base = getStoreBaseUrl();
	const recoveryToken = createAbandonedCartToken(cartId, 'recover', expiresAt);
	const unsubscribeToken = createAbandonedCartToken(cartId, 'unsubscribe', expiresAt);
	return {
		recoveryUrl: `${base}/cart/recover?token=${encodeURIComponent(recoveryToken)}`,
		unsubscribeUrl: `${base}/api/abandoned-carts/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`,
	};
}

export async function processAbandonedCarts(): Promise<{ enabled: boolean; considered: number; sent: number; recovered: number; suppressed: number; failed: number; deleted: number }> {
	const settings = await getAbandonedCartSettings();
	const summary = { enabled: settings.enabled, considered: 0, sent: 0, recovered: 0, suppressed: 0, failed: 0, deleted: 0 };
	const cutoff = new Date(Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000).toISOString();
	summary.deleted = await deleteExpiredAbandonedCarts(cutoff);
	await requeueStaleAbandonedCartClaims(new Date(Date.now() - 15 * 60 * 1000).toISOString());
	if (!settings.enabled) return summary;
	const businessIdentity = getAbandonedCartBusinessIdentity();

	const carts = await listDueAbandonedCarts(new Date().toISOString(), 20);
	summary.considered = carts.length;
	for (const cart of carts) {
		if (!(await claimAbandonedCartForSending(cart.id))) continue;
		try {
			if (await isAbandonedCartEmailSuppressed(cart.email)) {
				await updateAbandonedCartStatus(cart.id, 'suppressed', { lastError: null });
				summary.suppressed += 1;
				continue;
			}
			if (await hasOrderForEmailSince(cart.email, cart.consentAt)) {
				await markAbandonedCartsRecoveredByEmail(cart.email);
				summary.recovered += 1;
				continue;
			}
			const items = resolveRecoverableCartItems(cart.items, await readProducts());
			if (items.length === 0) {
				await updateAbandonedCartStatus(cart.id, 'suppressed', { lastError: 'No cart products are currently available.' });
				summary.suppressed += 1;
				continue;
			}
			const links = urls(cart.id, settings.retentionDays);
			const message = buildAbandonedCartEmail({ firstName: cart.firstName, items: toAbandonedCartDisplayItems(items), ...links, ...businessIdentity });
			const result = await sendMail({
				to: cart.email,
				from: process.env.ABANDONED_CART_FROM,
				smtpPrefix: 'ABANDONED_CART',
				...message,
			});
			if (!result.sent) throw new Error(result.error ?? 'SMTP delivery failed');
			const sentAt = new Date().toISOString();
			await updateAbandonedCartStatus(cart.id, 'sent', { sentAt, lastError: null });
			summary.sent += 1;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown send failure';
			await updateAbandonedCartStatus(cart.id, 'failed', { lastError: message.slice(0, 500) });
			summary.failed += 1;
		}
	}
	return summary;
}

export async function sendAbandonedCartTest(to: string): Promise<void> {
	const settings = await getAbandonedCartSettings();
	const sample = (await listAbandonedCarts(1))[0];
	if (!sample) throw new Error('Create an opted-in test cart before sending a test email.');
	const items = resolveRecoverableCartItems(sample.items, await readProducts());
	if (items.length === 0) throw new Error('The sample cart has no currently available products.');
	const links = urls(sample.id, settings.retentionDays);
	const message = buildAbandonedCartEmail({ firstName: sample.firstName || 'Test customer', items: toAbandonedCartDisplayItems(items), ...links, ...getAbandonedCartBusinessIdentity() });
	const result = await sendMail({
		to,
		from: process.env.ABANDONED_CART_FROM,
		smtpPrefix: 'ABANDONED_CART',
		subject: `[TEST] ${message.subject}`,
		text: message.text,
		html: message.html,
	});
	if (!result.sent) throw new Error(result.error ?? 'SMTP delivery failed');
}
