import { products as fallbackProducts } from '@/lib/products';
import { readProducts } from '@/lib/productCatalog';
import ProductGridClient from './ProductGridClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProductGrid() {
	let items = fallbackProducts;
	let stockUnavailable = false;
	try {
		items = await readProducts();
	} catch (error) {
		console.warn('ProductGrid: Using fallback products due to catalog error:', error);
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
