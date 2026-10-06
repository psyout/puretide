import { getStoreBaseUrl, verifyAbandonedCartToken } from '@/lib/abandonedCart';
import { getAbandonedCartById, suppressAbandonedCartEmail } from '@/lib/ordersDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function page(title: string, message: string, status = 200): Response {
	const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body style="margin:0;background:#f4f7f6;font-family:Arial,sans-serif;color:#173f3b"><main style="max-width:620px;margin:80px auto;padding:32px;background:#fff;border:1px solid #dce8e6;border-radius:16px"><h1>${title}</h1><p style="line-height:1.6">${message}</p><a href="${getStoreBaseUrl()}" style="color:#0b625b">Return to Pure Tide</a></main></body></html>`;
	return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function GET(request: Request) {
	try {
		const token = new URL(request.url).searchParams.get('token') ?? '';
		const verified = verifyAbandonedCartToken(token, 'unsubscribe');
		if (!verified) return page('Link expired', 'This unsubscribe link is invalid or has expired.', 400);
		const cart = await getAbandonedCartById(verified.cartId);
		if (!cart) return page('Already removed', 'This cart reminder is no longer active.');
		await suppressAbandonedCartEmail(cart.email, 'customer_unsubscribe');
		return page('You are unsubscribed', 'You will not receive any more abandoned-cart reminders from Pure Tide.');
	} catch (error) {
		console.error('[abandoned-cart:unsubscribe] failed', error);
		return page('Something went wrong', 'We could not process this request. Please contact info@puretide.ca.', 500);
	}
}
