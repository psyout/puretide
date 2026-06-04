import { products as fallbackProducts } from '@/lib/products';
import { readSheetProducts } from '@/lib/stockSheet';
import ProductGridClient from './ProductGridClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProductGrid() {
	let items = fallbackProducts;
	let stockUnavailable = false;
	try {
		items = await readSheetProducts();
	} catch (error) {
		console.warn('ProductGrid: Using fallback products due to sheet error:', error);
		items = fallbackProducts;
		stockUnavailable = true;
	}

	const visibleItems = items.filter((product) => {
		const status = product.status ?? 'published';
		return status === 'published' || status === 'stock-out';
	});
	return (
		<ProductGridClient
			initialItems={visibleItems}
			stockUnavailable={stockUnavailable}
		/>
	);
}
