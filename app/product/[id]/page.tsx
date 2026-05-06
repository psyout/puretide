import { notFound } from 'next/navigation';
import { products as fallbackProducts } from '@/lib/products';
import { readSheetProducts } from '@/lib/stockSheet';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/types/product';
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';
import ProductTabs from '@/components/ProductTabs';
import ProductActions from '@/components/ProductActions';
import Header from '@/components/Header';
import ProductDetailClient from '@/components/ProductDetailClient';
import { FlaskConical, FileText } from 'lucide-react';
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

export default async function ProductPage({ params }: ProductPageProps) {
	let items: Product[] = fallbackProducts;
	try {
		items = await readSheetProducts();
	} catch {
		items = fallbackProducts;
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
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<Header />
			<div className='max-w-7xl mx-auto px-6 py-24'>
				<Link
					href='/'
					className='text-deep-tidal-teal hover:text-eucalyptus mb-8 inline-block'>
					← Back to Products
				</Link>

				<div className='grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12'>
					<div className='md:col-start-2'>
						{/* Testides Lab badge */}
						{hasCoaFile && (
							<div className='mb-3'>
								<span className='inline-flex items-center gap-1.5 bg-slate-200 text-eucalyptus-800 text-xs font-semibold px-2 py-1 rounded-full'>Testides Lab</span>
							</div>
						)}

						{/* Mobile Image Container */}
						<div className='p-4 flex items-center justify-center mb-4 md:hidden'>
							<ProductImage product={product} />
						</div>

						{/* Product Detail Client - handles variants, pricing, icons, tabs, actions */}
						<ProductDetailClient
							product={product}
							description={product.description}
							details={product.details}
							hasCoaFile={hasCoaFile}
							matchingCoaFile={matchingCoaFile || ''}
						/>
					</div>

					{/* Desktop Image Container */}
					<div className='hidden md:flex md:col-start-1 md:row-start-1 md:justify-center lg:sticky lg:top-24 h-fit'>
						<div className='w-full max-w-sm rounded-2xl p-4 flex justify-center items-center'>
							<ProductImage
								product={product}
								priority
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
