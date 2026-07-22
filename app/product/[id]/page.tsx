import { notFound } from 'next/navigation';
import { products as fallbackProducts } from '@/lib/products';
import { readSheetProducts } from '@/lib/stockSheet';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/types/product';
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';
import Header from '@/components/Header';
import ProductDetailClient from '@/components/ProductDetailClient';
import { BadgeCheck, FlaskConical, PackageCheck, ShieldCheck } from 'lucide-react';
import fs from 'fs';
import path from 'path';

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
				className='w-auto h-auto max-h-[280px] md:max-h-[400px] lg:max-h-[500px] object-contain drop-shadow-xl transition-all duration-300'
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
		items = await readSheetProducts();
	} catch (error) {
		console.warn('ProductPage: Using fallback products due to sheet error:', error);
		items = fallbackProducts;
		stockUnavailable = true;
	}

	const slug = params.id;
	const product = items.find((item) => item.slug === slug || item.id === slug);

	if (!product || !['published', 'stock-out'].includes(product.status ?? 'published')) {
		notFound();
	}

	// Check if COA PDF exists for this product (match first 3 letters)
	const coaDir = path.join(process.cwd(), 'public', 'coa');
	const coaFiles = fs.readdirSync(coaDir).filter((file) => file.endsWith('.pdf'));
	const matchingCoaFile = coaFiles.find((file) => {
		const fileSlug = file.replace('puretide-coa-', '').replace('.pdf', '');
		return fileSlug.startsWith(product.slug.slice(0, 3));
	});
	const hasCoaFile = !!matchingCoaFile;

	return (
		<div className='min-h-screen'>
			<Header />
			<div className='max-w-7xl mx-auto px-6 py-24'>
				<Link
					href='/'
					className='text-deep-tidal-teal hover:text-eucalyptus mb-8 inline-block'>
					← Back to Products
				</Link>

				<div className='overflow-hidden'>
					<div className='grid grid-cols-1 md:grid-cols-[minmax(0,40%)_minmax(0,60%)]'>
						<div className='p-0 md:col-start-2 lg:p-10'>
							{/* Mobile Image Container */}
															<div className='relative p-4 flex items-center justify-center mb-4 md:hidden'>
																{hasCoaFile && <div className='absolute left-2 top-2 z-10'><TestidesBadge /></div>}
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
													<div className='hidden md:col-start-1 md:row-start-1 md:flex md:min-h-[660px] md:items-start md:justify-center md:p-6 lg:min-h-[720px] lg:p-10'>
														<div className='relative w-full max-w-sm bg-gradient-to-br from-eucalyptus-50 via-mineral-white to-deep-tidal-teal/10 px-4 py-16 flex justify-center items-start rounded-xl'>
															{hasCoaFile && <div className='absolute left-4 top-4 z-10'><TestidesBadge /></div>}
															<ProductImage
									product={product}
									priority
								/>
							</div>
						</div>
					</div>

					{/* Trust Indicators */}
					<div className='grid grid-rows-1 md:grid-cols-3 divide-x divide-deep-tidal-teal/10 border-t  border-deep-tidal-teal/10'>
						<div className='flex flex-col items-center justify-center gap-2 p-3 text-center md:flex-row md:gap-4 md:p-6 md:text-left'>
														<ShieldCheck className='h-10 w-10 shrink-0 stroke-[1.1] text-deep-tidal-teal-700 md:h-12 md:w-12' />
														<div>
															<h3 className='text-[11px] font-bold leading-tight text-deep-tidal-teal-900 md:text-sm'>Secure Checkout</h3>
															<p className='mt-1 text-[10px] leading-tight text-deep-tidal-teal-700 md:text-sm md:leading-normal'>Your payment is protected</p>
							</div>
						</div>
						<div className='flex flex-col items-center justify-center gap-2 p-3 text-center md:flex-row md:gap-4 md:p-6 md:text-left'>
														<BadgeCheck className='h-8 w-8 shrink-0 stroke-[1.1] text-deep-tidal-teal-700 md:h-12 md:w-12' />
														<div>
															<h3 className='text-[11px] font-bold leading-tight text-deep-tidal-teal-900 md:text-sm'>Quality Assured</h3>
															<p className='mt-1 text-[10px] leading-tight text-deep-tidal-teal-700 md:text-sm md:leading-normal'>Lab tested & verified</p>
							</div>
						</div>
						<div className='flex flex-col items-center justify-center gap-2 p-3 text-center md:flex-row md:gap-4 md:p-6 md:text-left'>
														<PackageCheck className='h-8 w-8 shrink-0 stroke-[1.1] text-deep-tidal-teal-700 md:h-12 md:w-12' />
														<div>
															<h3 className='text-[11px] font-bold leading-tight text-deep-tidal-teal-900 md:text-sm'>Discreet Packaging</h3>
															<p className='mt-1 text-[10px] leading-tight text-deep-tidal-teal-700 md:text-sm md:leading-normal'>Private & secure delivery</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
