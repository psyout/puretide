import { NextResponse } from 'next/server';
import { getMetaPixelId } from '@/lib/metaConversions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
	const pixelId = getMetaPixelId();
	return NextResponse.json(
		pixelId ? { enabled: true, pixelId } : { enabled: false },
		{ headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
	);
}
