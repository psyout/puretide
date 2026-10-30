import { sendMail } from '@/lib/email';
import { claimManualEtransferReminder, finishManualEtransferReminder, listOrdersFromDb, type StoredOrder } from '@/lib/ordersDb';

const DEFAULT_DELAY_HOURS = 2;
const PAYMENT_EMAIL = 'orders@puretide.ca';
const SUPPORT_EMAIL = 'info@puretide.ca';

type ReminderCartItem = {
	name?: unknown;
	price?: unknown;
	quantity?: unknown;
};

function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function money(value: unknown): string {
	const amount = Number(value ?? 0);
	return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number.isFinite(amount) ? amount : 0);
}

function orderDate(value: unknown): string {
	const date = new Date(String(value ?? ''));
	if (!Number.isFinite(date.getTime())) return '';
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Vancouver',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	}).format(date);
}

function getCartItems(order: StoredOrder): Array<{ name: string; price: number; quantity: number; lineTotal: number }> {
	if (!Array.isArray(order.cartItems)) return [];
	return (order.cartItems as ReminderCartItem[]).map((item) => {
		const price = Number(item.price ?? 0);
		const quantity = Number(item.quantity ?? 0);
		const safePrice = Number.isFinite(price) ? price : 0;
		const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
		return {
			name: String(item.name ?? 'Product').trim() || 'Product',
			price: safePrice,
			quantity: safeQuantity,
			lineTotal: safePrice * safeQuantity,
		};
	});
}

export function isManualEtransferReminderDue(order: StoredOrder, nowMs = Date.now(), delayHours = DEFAULT_DELAY_HOURS): boolean {
	if (order.paymentStatus !== 'pending' || order.paymentMethod !== 'etransfer') return false;
	if (order.paymentPath !== 'manual' && order.paymentPath !== 'manual_friends_family') return false;
	if (!String(order.wrikeTaskId ?? '').trim()) return false;
	const customer = order.customer as { email?: unknown } | undefined;
	if (!String(customer?.email ?? '').trim()) return false;
	const reminder = order.paymentReminder as Record<string, unknown> | undefined;
	if (reminder?.status === 'sent' || reminder?.status === 'sending') return false;
	const createdAtMs = Date.parse(String(order.createdAt ?? ''));
	return Number.isFinite(createdAtMs) && nowMs - createdAtMs >= delayHours * 60 * 60 * 1000;
}

export function buildManualEtransferReminderEmail(order: StoredOrder): { subject: string; text: string; html: string } {
	const customer = order.customer as { firstName?: unknown } | undefined;
	const firstName = String(customer?.firstName ?? 'there').trim() || 'there';
	const orderNumber = String(order.orderNumber ?? '').trim();
	const date = orderDate(order.createdAt);
	const items = getCartItems(order);
	const calculatedSubtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
	const subtotal = money(order.subtotal ?? calculatedSubtotal);
	const shippingCost = money(order.shippingCost);
	const discountAmount = Number(order.discountAmount ?? 0);
	const promoCode = String(order.promoCode ?? '').trim();
	const total = money(order.total);
	const storeUrl = String(process.env.APP_BASE_URL ?? 'https://puretide.ca').replace(/\/$/, '');
	const logoUrl = `${storeUrl}/logo.png`;
	const subject = `Reminder: e-Transfer required for order #${orderNumber}`;
	const itemsText = items.length > 0 ? items.map((item) => `- ${item.name} x${item.quantity} (${money(item.lineTotal)})`).join('\n') : '- Order details unavailable';
	const discountText = discountAmount > 0 ? `Discount${promoCode ? ` (${promoCode})` : ''}: -${money(discountAmount)}\n` : '';
	const text = [
		'Pure Tide',
		'',
		`Hi ${firstName},`,
		'',
		`Just a friendly reminder that order #${orderNumber} is still waiting for your e-Transfer. We'll begin processing it as soon as the payment is confirmed.`,
		'',
		'YOUR ORDER',
		`Order #${orderNumber}${date ? ` - ${date}` : ''}`,
		'',
		itemsText,
		'',
		`Subtotal: ${subtotal}`,
		`${discountText}Shipping: ${shippingCost}`,
		`Total: ${total} CAD`,
		'',
		"If you're still ready to continue, please send your payment using the details below:",
		'',
		`Recipient: ${PAYMENT_EMAIL}`,
		`Amount: ${total} CAD`,
		`Memo/message: ${orderNumber}`,
		'',
		'Please include your order number in the memo so we can match the payment quickly.',
		'',
		"Already sent it? No action is needed—we'll process the order as soon as the transfer is confirmed.",
		'',
		"Need help or changed your mind? Simply reply to this email and let us know. We're happy to help.",
		'',
		'Warmly,',
		'The Pure Tide team',
		SUPPORT_EMAIL,
	].join('\n');
	const itemsHtml =
		items.length > 0
			? items
					.map(
						(item) =>
							`<tr><td style="padding:10px 8px 10px 0;border-bottom:1px solid #edf2f1;vertical-align:top">${escapeHtml(item.name)}</td><td align="center" style="padding:10px 8px;border-bottom:1px solid #edf2f1;vertical-align:top">${escapeHtml(String(item.quantity))}</td><td align="right" style="padding:10px 0 10px 8px;border-bottom:1px solid #edf2f1;vertical-align:top;white-space:nowrap">${escapeHtml(money(item.lineTotal))}</td></tr>`,
					)
					.join('')
			: '<tr><td colspan="3" style="padding:10px 0;border-bottom:1px solid #edf2f1;color:#667b78">Order details unavailable</td></tr>';
	const discountHtml =
		discountAmount > 0
			? `<tr><td style="padding:3px 0;color:#667b78">Discount${promoCode ? ` (${escapeHtml(promoCode)})` : ''}</td><td align="right" style="padding:3px 0">-${escapeHtml(money(discountAmount))}</td></tr>`
			: '';
	const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f3f7f6"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f7f6"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #dce8e6;border-radius:14px;overflow:hidden"><tr><td style="height:6px;background:#1e5260;font-size:0;line-height:0">&nbsp;</td></tr><tr><td style="padding:26px 32px 20px;border-bottom:1px solid #e5efed"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding-right:14px"><img src="${escapeHtml(logoUrl)}" width="62" alt="Pure Tide" style="display:block;width:62px;height:auto;border:0"></td><td><div style="font-family:Arial,sans-serif;color:#1e5260;font-size:25px;font-weight:700;letter-spacing:.02em">PureTide</div><div style="font-family:Arial,sans-serif;color:#667b78;font-size:12px;letter-spacing:.08em;text-transform:uppercase">Advanced Peptide Wellness</div></td></tr></table></td></tr><tr><td style="padding:28px 32px 32px;font-family:Arial,sans-serif;color:#173f3b;font-size:16px;line-height:1.65"><p style="margin:0 0 16px">Hi ${escapeHtml(firstName)},</p><p style="margin:0 0 16px">Just a friendly reminder that order <strong>#${escapeHtml(orderNumber)}</strong> is still waiting for your e-Transfer. We’ll begin processing it as soon as the payment is confirmed.</p><h2 style="margin:24px 0 10px;color:#1e5260;font-family:Arial,sans-serif;font-size:18px;line-height:1.3">Your order</h2><div style="margin:0 0 12px;color:#667b78;font-size:13px">Order #${escapeHtml(orderNumber)}${date ? ` &middot; ${escapeHtml(date)}` : ''}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-size:14px"><tr><th align="left" style="padding:8px 8px 8px 0;border-bottom:1px solid #dce8e6;color:#667b78;font-size:12px;text-transform:uppercase">Product</th><th align="center" style="padding:8px;border-bottom:1px solid #dce8e6;color:#667b78;font-size:12px;text-transform:uppercase">Qty</th><th align="right" style="padding:8px 0 8px 8px;border-bottom:1px solid #dce8e6;color:#667b78;font-size:12px;text-transform:uppercase">Amount</th></tr>${itemsHtml}</table><table role="presentation" width="245" cellspacing="0" cellpadding="0" border="0" align="right" style="margin:10px 0 22px;font-size:14px"><tr><td style="padding:3px 0;color:#667b78">Subtotal</td><td align="right" style="padding:3px 0">${escapeHtml(subtotal)}</td></tr>${discountHtml}<tr><td style="padding:3px 0;color:#667b78">Shipping</td><td align="right" style="padding:3px 0">${escapeHtml(shippingCost)}</td></tr><tr><td style="padding:8px 0 3px;border-top:1px solid #dce8e6;color:#1e5260;font-size:17px;font-weight:700">Total</td><td align="right" style="padding:8px 0 3px;border-top:1px solid #dce8e6;color:#1e5260;font-size:17px;font-weight:700;white-space:nowrap">${escapeHtml(total)} CAD</td></tr></table><div style="clear:both"></div><p style="margin:0 0 16px">If you’re still ready to continue, please send your payment using the details below:</p><div style="margin:20px 0;padding:18px 20px;background:#f3f7f6;border-left:4px solid #1e5260;border-radius:8px"><strong>Recipient:</strong> ${PAYMENT_EMAIL}<br><strong>Amount:</strong> ${escapeHtml(total)} CAD<br><strong>Memo/message:</strong> ${escapeHtml(orderNumber)}</div><p style="margin:0 0 16px;color:#667b78;font-size:13px">Please include your order number in the memo so we can match the payment quickly.</p><p style="margin:0 0 16px"><strong>Already sent it?</strong> No action is needed—we’ll process the order as soon as the transfer is confirmed.</p><p style="margin:0 0 16px"><strong>Need help or changed your mind?</strong> Simply reply to this email and let us know. We’re happy to help.</p><p style="margin:26px 0 0">Warmly,<br><strong>The Pure Tide team</strong><br><a href="mailto:${SUPPORT_EMAIL}" style="color:#1e5260">${SUPPORT_EMAIL}</a></p></td></tr></table></td></tr></table></body></html>`;
	return { subject, text, html };
}

export async function getWrikePaymentStatus(taskId: string): Promise<string> {
	const apiToken = String(process.env.WRIKE_API_TOKEN ?? '').trim();
	const fieldId = String(process.env.WRIKE_PAYMENT_STATUS_FIELD_ID ?? '').trim();
	if (!apiToken || !fieldId) throw new Error('Wrike payment status is not configured.');
	const apiBase = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';
	const response = await fetch(`${apiBase}/tasks/${encodeURIComponent(taskId)}?fields=${encodeURIComponent(JSON.stringify(['customFields']))}`, {
		headers: { Authorization: `Bearer ${apiToken}` },
	});
	if (!response.ok) throw new Error(`Wrike task lookup failed (${response.status}).`);
	const body = (await response.json()) as { data?: Array<{ customFields?: Array<{ id?: string; value?: unknown }> }> };
	const field = body.data?.[0]?.customFields?.find((item) => String(item.id ?? '') === fieldId);
	return String(field?.value ?? '')
		.replace(/^"|"$/g, '')
		.trim()
		.toLowerCase();
}

export type ManualEtransferReminderSummary = { considered: number; sent: number; skipped: number; failed: number };

export async function processManualEtransferReminders(): Promise<ManualEtransferReminderSummary> {
	const delay = Number(process.env.ETRANSFER_REMINDER_DELAY_HOURS ?? DEFAULT_DELAY_HOURS);
	const delayHours = Number.isFinite(delay) && delay >= 1 ? delay : DEFAULT_DELAY_HOURS;
	const due = (await listOrdersFromDb()).filter((order) => isManualEtransferReminderDue(order, Date.now(), delayHours));
	const summary = { considered: due.length, sent: 0, skipped: 0, failed: 0 };
	for (const order of due.slice(0, 25)) {
		const orderNumber = String(order.orderNumber ?? '');
		let claimed = false;
		try {
			const wrikeStatus = await getWrikePaymentStatus(String(order.wrikeTaskId));
			if (wrikeStatus !== 'awaiting transfer') {
				summary.skipped += 1;
				continue;
			}
			const claimedOrder = await claimManualEtransferReminder(orderNumber);
			if (!claimedOrder) {
				summary.skipped += 1;
				continue;
			}
			claimed = true;
			const customer = claimedOrder.customer as { email?: unknown } | undefined;
			const message = buildManualEtransferReminderEmail(claimedOrder);
			const result = await sendMail({
				to: String(customer?.email ?? ''),
				from: process.env.ETRANSFER_REMINDER_FROM ?? SUPPORT_EMAIL,
				replyTo: SUPPORT_EMAIL,
				smtpPrefix: 'ORDER',
				...message,
			});
			if (!result.sent) throw new Error(result.error ?? 'Email delivery failed.');
			const sentAt = new Date().toISOString();
			await finishManualEtransferReminder(orderNumber, { sentAt });
			summary.sent += 1;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown reminder failure';
			if (claimed) await finishManualEtransferReminder(orderNumber, { failedAt: new Date().toISOString(), error: message });
			console.error('[manual-etransfer-reminder] failed', { orderNumber, error: message });
			summary.failed += 1;
		}
	}
	return summary;
}
