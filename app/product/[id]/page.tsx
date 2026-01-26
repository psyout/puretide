import { products as fallbackProducts } from '@/lib/products';
import { readSheetProducts } from '@/lib/stockSheet';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/types/product';
import ProductActions from '@/components/ProductActions';
import Header from '@/components/Header';
import { Activity, Droplets, Flower2, Gauge, HeartPulse, Leaf, Moon, Scale, Sparkles, Timer } from 'lucide-react';

const iconMap = {
	Activity,
	Droplets,
	Flower2,
	Gauge,
	HeartPulse,
	Leaf,
	Moon,
	Scale,
	Sparkles,
	Timer,
};

type ProductPageProps = {
	params: { id: string };
};

const ProductImage = ({ product, priority = false }: { product: Product; priority?: boolean }) => {
	if (product.image.startsWith('/') || product.image.startsWith('http')) {
		return (
			<Image
				src={product.image}
				alt={product.name}
				width={420}
				height={420}
				unoptimized={product.image.startsWith('http')}
				priority={priority}
				className='w-full h-auto max-h-[280px] lg:max-h-[500px] object-contain drop-shadow-xl transition-all duration-300'
			/>
		);
	}
	return <div className='text-9xl'>{product.image}</div>;
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
		return (
			<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
				<div className='max-w-7xl mx-auto px-6 py-12'>
					<h1 className='text-4xl font-bold mb-4 text-deep-tidal-teal-800'>Product not found</h1>
					<Link
						href='/'
						className='text-deep-tidal-teal hover:text-eucalyptus'>
						← Back to Products
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<Header />
			<div className='max-w-7xl mx-auto px-6 py-24'>
				<Link
					href='/'
					className='text-deep-tidal-teal hover:text-eucalyptus mb-8 inline-block'>
					← Back to Products
				</Link>

				<div className='grid grid-cols-1 lg:grid-cols-2 gap-12'>
					<div className='lg:col-start-2'>
						{/* Category */}
						<div className='flex flex-wrap items-center gap-3 mb-8'>
							<span className='text-[11px] text-deep-tidal-teal bg-eucalyptus-200/40 px-2 py-1 rounded inline-block'>{product.category}</span>
							{(product.stock <= 0 || product.status === 'stock-out') && (
								<span className='text-xs font-semibold uppercase tracking-wide bg-deep-tidal-teal text-mineral-white px-2 py-1 rounded-full'>Sold out</span>
							)}
						</div>
						{/* Product name and mg */}
						<div className='flex items-start gap-2 mb-4'>
							<h1 className='text-4xl font-bold text-deep-tidal-teal-800'>{product.name}</h1>
							{product.mg && <div className='inline-flex items-start justify-center text-deep-tidal-teal-600 font-bold text-[14px] mt-1'>{product.mg}mg</div>}
						</div>

						{/* Mobile Image Container */}
						<div className='bg-white/60 backdrop-blur-sm rounded-lg ui-border p-4 flex items-center justify-center shadow-sm mb-4 lg:hidden'>
							<ProductImage product={product} />
						</div>

						{product.icons && (
							<div className='grid grid-cols-3 gap-1 mt-8 lg:mt-4 mb-4 max-w-[260px] justify-items-start'>
								{product.icons.map((iconName: string) => {
									const Icon = iconMap[iconName as keyof typeof iconMap];
									if (!Icon) {
										return null;
									}
									return (
										<div
											key={iconName}
											className='flex flex-col items-center'>
											<div className='h-12 w-12 rounded-full bg-soft-driftwood flex items-center justify-center'>
												<Icon className='w-8 h-8 text-deep-tidal-teal-700' />
											</div>
											<span className='text-xs text-deep-tidal-teal-700 mt-2'>{iconName}</span>
										</div>
									);
								})}
							</div>
						)}
						<p className='text-deep-tidal-teal-700 text-lg mb-4'>{product.description}</p>
						{product.details && <p className='text-deep-tidal-teal-700 text-base'>{product.details}</p>}
					</div>

					{/* Desktop Image Container */}
					<div className='hidden lg:flex bg-white/60 backdrop-blur-sm rounded-lg ui-border p-8 items-center justify-center shadow-sm lg:col-start-1 lg:row-start-1 lg:row-end-3'>
						<ProductImage
							product={product}
							priority
						/>
					</div>

					<div className='lg:col-start-2'>
						<div className='text-4xl font-bold text-deep-tidal-teal-700 mb-8'>
							<span className=' text-deep-tidal-teal-600 font-light'>C</span>${product.price.toFixed(2)}
						</div>

						{/* Discount Table */}
						<div className='mb-8 max-w-md overflow-hidden rounded-xl border border-deep-tidal-teal/10 bg-white shadow-sm'>
							<div className='bg-deep-tidal-teal/5 px-4 py-2 border-b border-deep-tidal-teal/10'>
								<h3 className='text-sm font-bold text-deep-tidal-teal  tracking-wider'>Discount per quantity</h3>
							</div>
							<div className='overflow-x-auto'>
								<table className='w-full text-[15px] text-left'>
									<thead>
										<tr className='border-b border-deep-tidal-teal/5 bg-deep-tidal-teal/[0.02]'>
											<th className='px-4 py-2 font-semibold text-deep-tidal-teal-800'>Quantity</th>
											<th className='px-4 py-2 font-medium text-deep-tidal-teal-700'>2 - 5</th>
											<th className='px-4 py-2 font-medium text-deep-tidal-teal-700'>6 - 7</th>
											<th className='px-4 py-2 font-medium text-deep-tidal-teal-700'>8 - 9</th>
											<th className='px-4 py-2 font-medium text-deep-tidal-teal-700'>10 +</th>
										</tr>
									</thead>
									<tbody>
										<tr>
											<td className='px-4 py-3 font-semibold text-deep-tidal-teal-800 bg-deep-tidal-teal/[0.02]'>Discount</td>
											<td className='px-4 py-3 text-emerald-600 font-bold'>5%</td>
											<td className='px-4 py-3 text-emerald-600 font-bold'>10%</td>
											<td className='px-4 py-3 text-emerald-600 font-bold'>15%</td>
											<td className='px-4 py-3 text-emerald-600 font-bold'>25%</td>
										</tr>
										<tr className='border-t border-deep-tidal-teal/5'>
											<td className='px-4 py-3 font-semibold text-deep-tidal-teal-800 bg-deep-tidal-teal/[0.02]'>Price</td>
											<td className='px-4 py-3 text-deep-tidal-teal-700 font-medium'>${(product.price * 0.95).toFixed(2)}</td>
											<td className='px-4 py-3 text-deep-tidal-teal-700 font-medium'>${(product.price * 0.9).toFixed(2)}</td>
											<td className='px-4 py-3 text-deep-tidal-teal-700 font-medium'>${(product.price * 0.85).toFixed(2)}</td>
											<td className='px-4 py-3 text-deep-tidal-teal-700 font-medium'>${(product.price * 0.75).toFixed(2)}</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>

						<ProductActions product={product} />
					</div>
				</div>
			</div>
		</div>
	);
}
