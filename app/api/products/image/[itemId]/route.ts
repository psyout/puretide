import { NextResponse } from 'next/server';
import { readProducts } from '@/lib/productCatalog';
import { readZohoItemImage } from '@/lib/zohoInventory';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { itemId: string } }) {
	const itemId = String(params.itemId ?? '').trim();
	try {
		const products = await readProducts();
		const isStorefrontItem = products.some(
			(product) => product.zohoItemId === itemId || product.variants?.some((variant) => variant.zohoItemId === itemId),
		);
		if (!isStorefrontItem) return NextResponse.json({ error: 'Product image not found.' }, { status: 404 });

		const image = await readZohoItemImage(itemId);
		return new Response(image.bytes, {
			headers: {
				'Content-Type': image.contentType,
				'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
			},
		});
	} catch (error) {
		console.error('[product-image] failed', { itemId, message: error instanceof Error ? error.message : String(error) });
		return NextResponse.json({ error: 'Product image unavailable.' }, { status: 502 });
	}
}
