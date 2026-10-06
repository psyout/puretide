import { NextResponse } from 'next/server';
import { resolveRecoverableCartItems, verifyAbandonedCartToken } from '@/lib/abandonedCart';
import { getAbandonedCartById, updateAbandonedCartStatus } from '@/lib/ordersDb';
import { readProducts } from '@/lib/productCatalog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
	try {
		const url = new URL(request.url);
		const token = url.searchParams.get('token') ?? '';
		const verified = verifyAbandonedCartToken(token, 'recover');
		if (!verified) return NextResponse.json({ ok: false, error: 'This recovery link is invalid or expired.' }, { status: 400 });
		const cart = await getAbandonedCartById(verified.cartId);
		if (!cart || cart.status === 'suppressed') return NextResponse.json({ ok: false, error: 'This cart is no longer available.' }, { status: 404 });
		const products = await readProducts();
		const items = resolveRecoverableCartItems(cart.items, products);
		if (items.length === 0) return NextResponse.json({ ok: false, error: 'The products in this cart are no longer available.' }, { status: 410 });
		await updateAbandonedCartStatus(cart.id, cart.status, { clickedAt: new Date().toISOString(), lastError: null });
		return NextResponse.json({ ok: true, items });
	} catch (error) {
		console.error('[abandoned-cart:recover] failed', error);
		return NextResponse.json({ ok: false, error: 'Unable to recover this cart.' }, { status: 500 });
	}
}
