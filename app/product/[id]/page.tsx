import { notFound } from 'next/navigation';
import { products as fallbackProducts } from '@/lib/products';
import { readProducts } from '@/lib/productCatalog';
import StoreBreadcrumb from '@/components/StoreBreadcrumb';
import Image from 'next/image';
import type { Product } from '@/types/product';
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';
import PromoBannerWrapper from '@/components/PromoBannerWrapper';
import ProductDetailClient from '@/components/ProductDetailClient';
import fs from 'fs';
import path from 'path';
import { resolveProductCoaFile } from '@/lib/productCoa';

type ProductPageProps = {
	params: { id: string };
};

const ProductImage = ({ product, priority = false }: { product: Product; priority?: boolean }) => {
	if (hasProductImage(product.image)) {
		return (
			<Image
				src={product.image}
				alt={product.name}
				width={400}
				height={400}
				style={{ width: 'auto', height: 'auto' }}
				unoptimized={product.image.startsWith('http')}
				priority={priority}
				className='h-auto w-auto max-h-[280px] max-w-full object-contain drop-shadow-xl transition-all duration-300 md:max-h-[400px] md:max-w-[400px] lg:max-h-[500px]'
			/>
		);
	}
	return <ProductImagePlaceholder className='w-auto h-auto max-h-[280px] md:max-h-[400px] lg:max-h-[500px] object-contain' />;
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
	const breadcrumbItems = [
		{ label: 'Shop', href: '/#products' },
		...(product.category ? [{ label: product.category, href: `/?category=${encodeURIComponent(product.category)}#products` }] : []),
		{ label: product.name },
	];

	return (
		<div className='min-h-screen'>
			<PromoBannerWrapper
				enabled={promoBannerEnabled}
				message={process.env.NEXT_PUBLIC_PROMO_BANNER_MESSAGE}
				cta={process.env.NEXT_PUBLIC_PROMO_BANNER_CTA}
			/>
			<div className='mx-auto max-w-5xl px-4 pb-10 pt-32 sm:px-6'>
				<StoreBreadcrumb items={breadcrumbItems} />

				<div className='grid grid-cols-1 gap-y-6 md:grid-cols-2 md:items-start md:gap-x-8 lg:gap-x-10'>
					<div className='flex min-h-[300px] items-center justify-center rounded-2xl bg-gradient-to-br from-eucalyptus-50 via-mineral-white to-deep-tidal-teal/10 p-6 md:col-start-1 md:row-start-1 md:min-h-[560px] md:p-10'>
						<ProductImage
							product={product}
							priority
						/>
					</div>

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
