import { notFound } from 'next/navigation';
import { products as fallbackProducts } from '@/lib/products';
import { readProducts } from '@/lib/productCatalog';
import StoreBreadcrumb from '@/components/StoreBreadcrumb';
import type { Product } from '@/types/product';
import PromoBannerWrapper from '@/components/PromoBannerWrapper';
import ProductDetailClient from '@/components/ProductDetailClient';
import fs from 'fs';
import path from 'path';
import { resolveProductCoaFile } from '@/lib/productCoa';
import { getProductFilterCategory } from '@/lib/productCategories';

type ProductPageProps = {
	params: { id: string };
};

export default async function ProductPage({ params }: ProductPageProps) {
	let items: Product[] = fallbackProducts;
	let stockUnavailable = false;
	try {
		items = await readProducts();
	} catch (error) {
		console.warn('ProductPage: Using fallback products due to catalog error:', error);
		items = fallbackProducts;
		stockUnavailable = true;
	}

	const slug = params.id;
	const product = items.find((item) => item.slug === slug || item.id === slug);

	if (!product || !['published', 'stock-out'].includes(product.status ?? 'published')) {
		notFound();
	}

	// The spreadsheet explicitly selects the COA. Never infer it from the slug:
	// products with similar slugs may require different certificates.
	const coaDir = path.join(process.cwd(), 'public', 'coa');
	const coaFiles = fs.readdirSync(coaDir).filter((file) => file.endsWith('.pdf'));
	const matchingCoaFile = resolveProductCoaFile(product.coaFile, coaFiles);
	const hasCoaFile = !!matchingCoaFile;
	const relatedProducts = items
		.filter((item) => item.id !== product.id && item.slug !== product.slug && item.category === product.category && ['published', 'stock-out'].includes(item.status ?? 'published'))
		.slice(0, 4);

	const promoBannerEnabled = String(process.env.NEXT_PUBLIC_PROMO_BANNER_ENABLED ?? '').toLowerCase() === 'true';
	const breadcrumbCategory = product.category ? getProductFilterCategory(product.category) : null;
	const breadcrumbItems = [
		{ label: 'Shop', href: '/#products' },
		...(breadcrumbCategory ? [{ label: breadcrumbCategory, href: `/?category=${encodeURIComponent(breadcrumbCategory)}#products` }] : []),
		{ label: product.name },
	];

	return (
		<div className='min-h-screen'>
			<PromoBannerWrapper
				enabled={promoBannerEnabled}
				message={process.env.NEXT_PUBLIC_PROMO_BANNER_MESSAGE}
				cta={process.env.NEXT_PUBLIC_PROMO_BANNER_CTA}
			/>
			<div className='mx-auto max-w-6xl px-6 pb-10 pt-32 sm:px-6'>
				<StoreBreadcrumb items={breadcrumbItems} />

				<div>
					<ProductDetailClient
						product={product}
						description={product.description}
						details={product.details}
						hasCoaFile={hasCoaFile}
						matchingCoaFile={matchingCoaFile || ''}
						stockUnavailable={stockUnavailable}
						relatedProducts={relatedProducts}
					/>
				</div>
			</div>
		</div>
	);
}
