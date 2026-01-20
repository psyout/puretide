import { products as fallbackProducts } from '@/lib/products';
import { readSheetProducts } from '@/lib/stockSheet';
import ProductGridClient from './ProductGridClient';

export default async function ProductGrid() {
	let items = fallbackProducts;
	try {
		items = await readSheetProducts();
	} catch {
		items = fallbackProducts;
	}

	const visibleItems = items.filter((product) => {
		const status = product.status ?? 'published';
		return status === 'published' || status === 'stock-out';
	});
	return <ProductGridClient initialItems={visibleItems} />;
}
