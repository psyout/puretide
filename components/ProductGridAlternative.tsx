import { products as fallbackProducts } from '@/lib/products';
import { readSheetProducts } from '@/lib/stockSheet';
import ProductGridAlternativeClient from './ProductGridAlternativeClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProductGridAlternative() {
	let items = fallbackProducts;
	let stockUnavailable = false;

	try {
		items = await readSheetProducts();
	} catch (error) {
		console.warn('ProductGridAlternative: Using fallback products due to sheet error:', error);
		stockUnavailable = true;
	}

	const visibleItems = items.filter((product) => {
		const status = product.status ?? 'published';
		return status === 'published' || status === 'stock-out';
	});

	return <ProductGridAlternativeClient initialItems={visibleItems} stockUnavailable={stockUnavailable} />;
}
