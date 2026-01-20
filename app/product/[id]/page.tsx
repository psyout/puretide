'use client';

import { useEffect, useMemo, useState } from 'react';
import { products as fallbackProducts } from '@/lib/products';
import { useCart } from '@/context/CartContext';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/types/product';
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
} from 'lucide-react';

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

export default function ProductPage() {
	const params = useParams();
	const router = useRouter();
	const { addToCart } = useCart();
	const [items, setItems] = useState<Product[]>(fallbackProducts);
	const slug = Array.isArray(params.id) ? params.id[0] : params.id;

	useEffect(() => {
		const load = async () => {
			try {
				const response = await fetch('/api/stock');
				const data = (await response.json()) as { ok: boolean; items?: Product[] };
				if (data.ok && data.items) {
					setItems(data.items);
				}
			} catch {
				setItems(fallbackProducts);
			}
		};
		void load();
	}, []);

	const product = useMemo(
		() => items.find((item) => item.slug === slug || item.id === slug),
		[items, slug]
	);

	if (!product) {
		return (
			<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
				<div className='container mx-auto px-4 py-12'>
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
			<div className='container mx-auto px-6 py-12'>
				<Link
					href='/'
					className='text-deep-tidal-teal hover:text-eucalyptus mb-8 inline-block'>
					← Back to Products
				</Link>

				<div className='grid grid-cols-1 lg:grid-cols-2 gap-12'>
					<div className='lg:col-start-2'>
						<div className='flex flex-wrap items-center gap-3 mb-4'>
							<span className='text-sm text-deep-tidal-teal bg-eucalyptus-200 px-3 py-1 rounded inline-block'>{product.category}</span>
							{product.stock <= 0 && (
								<span className='text-xs font-semibold uppercase tracking-wide bg-deep-tidal-teal text-mineral-white px-2 py-1 rounded-full'>
									Sold out
								</span>
							)}
						</div>
						<h1 className='text-4xl font-bold mb-4 text-deep-tidal-teal-800'>{product.name}</h1>
						<div className='bg-white/60 backdrop-blur-sm rounded-lg ui-border p-3 flex items-center justify-center shadow-lg mb-4 lg:hidden'>
							{product.image.startsWith('/') || product.image.startsWith('http') ? (
								<Image
									src={product.image}
									alt={product.name}
									width={420}
									height={420}
									style={{ width: 'auto', height: 'auto' }}
									unoptimized={product.image.startsWith('http')}
									className='max-w-full max-h-96 w-auto h-auto object-contain drop-shadow-xl'
								/>
							) : (
								<div className='text-9xl'>{product.image}</div>
							)}
						</div>
						{product.icons && (
							<div className='grid grid-cols-3 gap-1 mt-5 mb-7 max-w-[260px] justify-items-start'>
								{product.icons.map((iconName: string) => {
									const Icon = iconMap[iconName as keyof typeof iconMap];
									if (!Icon) {
										return null;
									}
									return (
										<div
											key={iconName}
											className='flex flex-col items-center'>
											<div className='h-12 w-12 rounded-full bg-eucalyptus flex items-center justify-center'>
												<Icon className='w-8 h-8 text-deep-tidal-teal' />
											</div>
											<span className='text-xs text-deep-tidal-teal mt-2'>{iconName}</span>
										</div>
									);
								})}
							</div>
						)}
						<p className='text-deep-tidal-teal-700 text-lg mb-4'>{product.description}</p>
						{product.details && (
							<p className='text-deep-tidal-teal-700 text-base mb-6'>{product.details}</p>
						)}
					</div>

					<div className='hidden lg:flex bg-white/60 backdrop-blur-sm rounded-lg ui-border p-12 items-center justify-center shadow-lg lg:col-start-1 lg:row-start-1 lg:row-end-3'>
						{product.image.startsWith('/') || product.image.startsWith('http') ? (
							<Image
								src={product.image}
								alt={product.name}
								width={420}
								height={420}
								style={{ width: 'auto', height: 'auto' }}
								unoptimized={product.image.startsWith('http')}
								priority
								className='max-w-full max-h-96 w-auto h-auto object-contain drop-shadow-xl'
							/>
						) : (
							<div className='text-9xl'>{product.image}</div>
						)}
					</div>

					<div className='lg:col-start-2'>
						<div className='text-4xl font-bold text-deep-tidal-teal mb-8'>${product.price.toFixed(2)}</div>

						<div className='space-y-4'>
							<button
								onClick={() => {
									addToCart(product);
									router.push('/cart');
								}}
								disabled={product.stock <= 0}
								className='w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 disabled:bg-muted-sage-400 text-mineral-white font-semibold py-4 px-6 rounded transition-colors text-lg'>
								{product.stock <= 0 ? 'Sold out' : 'Add to Cart'}
							</button>
							<div className='bg-eucalyptus-100/10 p-4 rounded ui-border shadow-md'>
								<div className='flex items-center gap-2 mb-2'>
									<svg className='w-5 h-5 text-deep-tidal-teal' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
									</svg>
									<h3 className='font-semibold text-deep-tidal-teal-800'>Privacy Guaranteed</h3>
								</div>
								<p className='text-sm text-deep-tidal-teal-700'>This purchase is completely anonymous. No tracking, no data collection, no third-party sharing.</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
