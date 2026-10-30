import { notFound } from 'next/navigation';
import { products as fallbackProducts } from '@/lib/products';
import { readProducts } from '@/lib/productCatalog';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/types/product';
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';
import PromoBannerWrapper from '@/components/PromoBannerWrapper';
import ProductDetailClient from '@/components/ProductDetailClient';
import { BadgeCheck, FlaskConical, PackageCheck, ShieldCheck } from 'lucide-react';
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

const TestidesBadge = () => (
	<span className='inline-flex items-center gap-2 rounded-full bg-eucalyptus-100 px-3 py-2 text-sm font-semibold text-deep-tidal-teal-800 shadow-sm'>
		<FlaskConical className='h-5 w-5' />
		Testides Lab
	</span>
);

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

	const promoBannerEnabled = String(process.env.NEXT_PUBLIC_PROMO_BANNER_ENABLED ?? '').toLowerCase() === 'true';

	return (
		<div className='min-h-screen'>
			<PromoBannerWrapper
				enabled={promoBannerEnabled}
				message={process.env.NEXT_PUBLIC_PROMO_BANNER_MESSAGE}
				cta={process.env.NEXT_PUBLIC_PROMO_BANNER_CTA}
			/>
			<div className='max-w-6xl mx-auto px-6 pt-32 pb-10'>
				<nav
					aria-label='Breadcrumb'
					className='mb-8 min-w-0'>
					<ol className='flex min-w-0 items-center gap-2 text-[0.95rem] leading-6'>
						<li className='shrink-0'>
							<Link
								href='/#products'
								className='font-medium text-deep-tidal-teal-600 underline-offset-4 transition-colors hover:text-deep-tidal-teal hover:underline'>
								Shop
							</Link>
						</li>
						<li
							aria-hidden='true'
							className='shrink-0 text-deep-tidal-teal-400'>
							/
						</li>
						<li
							aria-current='page'
							className='truncate font-semibold text-deep-tidal-teal-800'>
							{product.name}
						</li>
					</ol>
				</nav>

				<div className='overflow-hidden'>
					<div className='grid grid-cols-1 md:grid-cols-2 md:items-start md:gap-10 lg:gap-12'>
						<div className='p-0 md:col-start-2 md:w-full'>
							{/* Mobile Image Container */}
							<div className='relative p-4 flex items-center justify-center mb-4 md:hidden'>
								{hasCoaFile && (
									<div className='absolute left-2 top-2 z-10'>
										<TestidesBadge />
									</div>
								)}
								<ProductImage product={product} />
							</div>

							{/* Product Detail Client - handles variants, pricing, icons, tabs, actions */}
							<ProductDetailClient
								product={product}
								description={product.description}
								details={product.details}
								hasCoaFile={hasCoaFile}
								matchingCoaFile={matchingCoaFile || ''}
								stockUnavailable={stockUnavailable}
							/>
						</div>

						{/* Desktop Image Container */}
						<div className='hidden md:col-start-1 md:row-start-1 md:flex md:min-h-[660px] md:items-start lg:min-h-[720px]'>
							<div className='relative flex w-full items-start justify-center rounded-xl bg-gradient-to-br from-eucalyptus-50 via-mineral-white to-deep-tidal-teal/10 px-4 py-16'>
								{hasCoaFile && (
									<div className='absolute left-4 top-4 z-10'>
										<TestidesBadge />
									</div>
								)}
								<ProductImage
									product={product}
									priority
								/>
							</div>
						</div>
					</div>

					{/* Trust Indicators */}
					<div className='grid grid-rows-1 md:grid-cols-3 divide-y divide-deep-tidal-teal/10 md:divide-y-0 md:divide-x border-t border-deep-tidal-teal/10 mt-5'>
						<div className='flex flex-col items-center justify-center gap-3 p-5 text-center md:flex-row md:gap-4 md:p-6 md:text-left'>
							<BadgeCheck className='h-10 w-10 shrink-0 stroke-[1.1] text-deep-tidal-teal-700 md:h-13 md:w-13' />
							<div>
								<h3 className='text-sm font-bold leading-tight text-deep-tidal-teal-900 md:text-[15px]'>Quality & Purity Assured</h3>
								<p className='mt-1 text-sm leading-normal text-deep-tidal-teal-700 md:text-[14px]'>99% purity, lab tested & verified</p>
							</div>
						</div>
						<div className='flex flex-col items-center justify-center gap-3 p-5 text-center md:flex-row md:gap-4 md:p-6 md:text-left'>
							<ShieldCheck className='h-10 w-10 shrink-0 stroke-[1.1] text-deep-tidal-teal-700 md:h-13 md:w-13' />
							<div>
								<h3 className='text-sm font-bold leading-tight text-deep-tidal-teal-900 md:text-[15px]'>Secure Checkout</h3>
								<p className='mt-1 text-sm leading-normal text-deep-tidal-teal-700 md:text-[14px]'>Your payment is protected</p>
							</div>
						</div>
						<div className='flex flex-col items-center justify-center gap-3 p-5 text-center md:flex-row md:gap-4 md:p-6 md:text-left'>
							<PackageCheck className='h-10 w-10 shrink-0 stroke-[1.1] text-deep-tidal-teal-700 md:h-13 md:w-13' />
							<div>
								<h3 className='text-sm font-bold leading-tight text-deep-tidal-teal-900 md:text-[15px]'>Ships within 48–72 hours</h3>
								<p className='mt-1 text-sm leading-normal text-deep-tidal-teal-700 md:text-[14px]'>Express shipping in up to 2 business days</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
