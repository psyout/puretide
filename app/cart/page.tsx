import CartClient from '@/components/CartClient';
import PromoBannerWrapper from '@/components/PromoBannerWrapper';
import { getCachedSheetProducts } from '@/lib/sheetCache';
import { products as fallbackProducts } from '@/lib/products';
import type { Product } from '@/types/product';

export default async function CartPage() {
	const promoBannerEnabled = String(process.env.NEXT_PUBLIC_PROMO_BANNER_ENABLED ?? '').toLowerCase() === 'true';

	let products: Product[] = fallbackProducts;
	let stockUnavailable = false;
	try {
		products = await getCachedSheetProducts();
	} catch (error) {
		console.warn('CartPage: Using fallback products due to sheet error:', error);
		products = fallbackProducts;
		stockUnavailable = true;
	}

	return (
		<>
			<PromoBannerWrapper
				enabled={promoBannerEnabled}
				message={process.env.NEXT_PUBLIC_PROMO_BANNER_MESSAGE}
				cta={process.env.NEXT_PUBLIC_PROMO_BANNER_CTA}
			/>
			<CartClient
				products={products}
				stockUnavailable={stockUnavailable}
			/>
		</>
	);
}
