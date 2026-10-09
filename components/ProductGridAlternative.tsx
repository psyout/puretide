import { products as fallbackProducts } from '@/lib/products';
import { readProducts } from '@/lib/productCatalog';
import { getCachedAutomaticSitewidePromo } from '@/lib/sheetCache';
import ProductGridAlternativeClient from './ProductGridAlternativeClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProductGridAlternative() {
	let items = fallbackProducts;
	let stockUnavailable = false;

	try {
		items = await readProducts();
	} catch (error) {
		console.warn('ProductGridAlternative: Using fallback products due to catalog error:', error);
		stockUnavailable = true;
	}

	const visibleItems = items.filter((product) => {
		const status = product.status ?? 'published';
		return status === 'published' || status === 'stock-out';
	});
	const automaticPromotion = await getCachedAutomaticSitewidePromo();

	return <ProductGridAlternativeClient initialItems={visibleItems} stockUnavailable={stockUnavailable} automaticPromotion={automaticPromotion} />;
}
