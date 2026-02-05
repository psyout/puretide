import { products as fallbackProducts } from '@/lib/products';
import { readSheetProducts } from '@/lib/stockSheet';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/types/product';
import ProductActions from '@/components/ProductActions';
import ProductTabs from '@/components/ProductTabs';
import Header from '@/components/Header';
import {
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
	Zap,
	Bone,
	Clock,
	Brain,
	Shield,
	Heart,
	Flame,
	TrendingUp,
	Sun,
	Pill,
	CreditCard,
	Truck,
} from 'lucide-react';

const iconMap = {
	Activity: Activity,
	Hydration: Droplets,
	Wellness: Flower2,
	Performance: Gauge,
	Vitality: HeartPulse,
	Natural: Leaf,
	Sleep: Moon,
	Balance: Scale,
	Energy: Sparkles,
	FastActing: Timer,
	Recovery: Zap,
	'Muscle Health': Bone,
	AntiAging: Clock,
	Cognitive: Brain,
	Immune: Shield,
	'Sexual Health': Heart,
	Metabolic: Flame,
	Growth: TrendingUp,
	Longevity: Clock,
	Skin: Sun,
	Digestive: Pill,
	Intimacy: Heart,
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
				width={400}
				height={400}
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
						{/* Sold out badge */}
						{(product.stock <= 0 || product.status === 'stock-out') && (
							<div className='mb-4'>
								<span className='text-xs font-semibold uppercase tracking-wide bg-deep-tidal-teal text-mineral-white px-2 py-1 rounded-md'>Sold out</span>
							</div>
						)}
						{/* Product name and mg */}
						<div className='flex items-start gap-2'>
							<h1 className='text-4xl font-bold text-deep-tidal-teal-800'>{product.name}</h1>
							{product.mg && <div className='inline-flex items-start justify-center text-deep-tidal-teal-600 font-bold text-base mt-1'>{product.mg}mg</div>}
						</div>
						{product.subtitle && <p className='text-lg text-deep-tidal-teal-600 font-medium mb-4'>{product.subtitle}</p>}
						{!product.subtitle && <div className='mb-4' />}
						{/* Mobile Image Container */}
						<div className='bg-white/60 backdrop-blur-sm rounded-lg ui-border p-4 flex items-center justify-center shadow-sm mb-4 lg:hidden'>
							<ProductImage product={product} />
						</div>
						{/* Icons - Pill style */}
						{product.icons && product.icons.length > 0 && (
							<div className='flex flex-wrap gap-2 mt-4 mb-6'>
								{product.icons.map((iconName: string) => {
									const Icon = iconMap[iconName as keyof typeof iconMap];
									if (!Icon) {
										return null;
									}
									return (
										<div
											key={iconName}
											className='inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-eucalyptus-100'>
											<Icon className='w-5 h-5 text-deep-tidal-teal-700' />
											<span className='text-xs font-medium text-deep-tidal-teal-700'>{iconName}</span>
										</div>
									);
								})}
							</div>
						)}
						{/* Description & Details Tabs */}
						<div className='mb-6'>
							<ProductTabs
								description={product.description}
								details={product.details}
							/>
						</div>
						{/* Price */}
						<div className='mt-8'>
							<div className='text-4xl mt-4 font-bold text-deep-tidal-teal-700'>
								<span className='text-deep-tidal-teal-700 text-[2rem] font-light'>C</span>${product.price.toFixed(2)}
							</div>
							<div className='flex items-center gap-3 text-sm text-deep-tidal-teal-600 mb-6'>
								<span className='flex items-center gap-1'>
									<CreditCard className='w-4 h-4' />
									+5% card fee
								</span>
								<span className='text-deep-tidal-teal-300'>•</span>
								<span className='flex items-center gap-1 text-emerald-600'>
									<Truck className='w-4 h-4' />
									Free shipping over $400
								</span>
							</div>
						</div>
						{/* Discount Table */}
						{product.slug !== 'bacteriostatic-water' && (
							<div className='mb-6 max-w-md overflow-hidden rounded-lg border border-deep-tidal-teal/10 bg-white shadow-sm'>
								<div className='bg-deep-tidal-teal/5 px-4 py-2 border-b border-deep-tidal-teal/10'>
									<h3 className='text-sm font-bold text-deep-tidal-teal tracking-wider'>Discount per quantity</h3>
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
						)}
						{/* 
						{product.slug !== 'bacteriostatic-water' && (
							<div className='mb-6'>
								<p className='text-sm font-semibold text-deep-tidal-teal-700 mb-3'>Buy more, save more</p>
								<div className='flex gap-2.5 overflow-x-auto pb-2 -mx-6 px-6 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible'>
									<div className='flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-deep-tidal-teal/15 shadow-sm hover:shadow-md hover:border-deep-tidal-teal/25 transition-all duration-200'>
										<span className='text-sm font-medium text-deep-tidal-teal-500'>2 - 5</span>
										<span className='text-sm font-bold text-emerald-600'>5% off</span>
									</div>
									<div className='flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-deep-tidal-teal/15 shadow-sm hover:shadow-md hover:border-deep-tidal-teal/25 transition-all duration-200'>
										<span className='text-sm font-medium text-deep-tidal-teal-500'>6 - 7</span>
										<span className='text-sm font-bold text-emerald-600'>10% off</span>
									</div>
									<div className='flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-deep-tidal-teal/15 shadow-sm hover:shadow-md hover:border-deep-tidal-teal/25 transition-all duration-200'>
										<span className='text-sm font-medium text-deep-tidal-teal-500'>8 - 9</span>
										<span className='text-sm font-bold text-emerald-600'>15% off</span>
									</div>
									<div className='flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300/40 shadow-sm hover:shadow-md hover:border-emerald-400/50 transition-all duration-200'>
										<span className='text-sm font-bold text-emerald-700'>10+</span>
										<span className='text-sm font-bold text-emerald-700'>25% off</span>
									</div>
								</div>
							</div>
						)}*/}
						{/* Research disclaimer */}
						<p className='text-xs text-deep-tidal-teal-600 mb-6 italic'>*For research use only and are not intended for human or animal consumption.</p>
						{/* Actions - At the end */}
						<ProductActions product={product} />
					</div>

					{/* Desktop Image Container */}
					<div className='hidden lg:flex bg-white/60 backdrop-blur-sm rounded-lg ui-border p-4 items-center justify-center shadow-sm lg:col-start-1 lg:row-start-1 h-fit'>
						<ProductImage
							product={product}
							priority
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
