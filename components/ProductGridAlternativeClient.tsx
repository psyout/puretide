'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { Product } from '@/types/product';
import ProductCardAlternative from './ProductCardAlternative';

type ProductGridAlternativeClientProps = {
	initialItems: Product[];
	stockUnavailable?: boolean;
};

export default function ProductGridAlternativeClient({ initialItems, stockUnavailable = false }: ProductGridAlternativeClientProps) {
	const [selectedCategory, setSelectedCategory] = useState('All');
	const [items, setItems] = useState<Product[]>(initialItems);
	const [isLoading, setIsLoading] = useState(initialItems.length === 0);
	const [loadedImageIds, setLoadedImageIds] = useState<Set<string>>(new Set());
	const [imageGateExpired, setImageGateExpired] = useState(false);

	useEffect(() => {
		if (stockUnavailable) console.warn('[stock] Rendering the alternative product grid without real-time inventory.');
	}, [stockUnavailable]);

	useEffect(() => {
		setItems(initialItems);
		setIsLoading(false);
	}, [initialItems]);

	const categories = useMemo(() => ['All', ...Array.from(new Set(items.map((product) => product.category)))], [items]);
	const visibleProducts = useMemo(() => (selectedCategory === 'All' ? items : items.filter((product) => product.category === selectedCategory)), [items, selectedCategory]);
	const expectedImageIds = useMemo(() => visibleProducts.map((product) => product.id), [visibleProducts]);
	const expectedImageIdsKey = expectedImageIds.join('|');

	useEffect(() => {
		setLoadedImageIds(new Set());
		setImageGateExpired(false);
	}, [expectedImageIdsKey]);

	useEffect(() => {
		if (expectedImageIds.length === 0) return;
		const timeout = window.setTimeout(() => setImageGateExpired(true), 2500);
		return () => window.clearTimeout(timeout);
	}, [expectedImageIds.length, expectedImageIdsKey]);

	const handleImageLoaded = useCallback((productId: string) => {
		setLoadedImageIds((current) => {
			if (current.has(productId)) return current;
			const next = new Set(current);
			next.add(productId);
			return next;
		});
	}, []);

	const allImagesLoaded = expectedImageIds.length === 0 || expectedImageIds.every((id) => loadedImageIds.has(id));
	const showSkeleton = isLoading || (visibleProducts.length > 0 && !imageGateExpired && !allImagesLoaded);
	const skeletonCount = visibleProducts.length || initialItems.length || 6;

	return (
		<section
			id='products'
			aria-labelledby='alternative-products-title'
			className='relative left-1/2 right-1/2 w-screen -mx-[50vw] overflow-hidden py-20 scroll-mt-10 sm:py-24 lg:py-28'
			style={{
				backgroundColor: 'var(--color-primary, #f5f7f8)',
				backgroundImage: 'linear-gradient(#dde8ed 1px, transparent 1px), linear-gradient(90deg, #dde8ed 1px, transparent 1px)',
				backgroundSize: '32px 32px',
			}}>
			<div
				aria-hidden='true'
				className='absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-deep-tidal-teal-800/20 to-transparent'
			/>
			<div
				aria-hidden='true'
				className='absolute -left-48 top-40 h-96 w-96 rounded-full bg-eucalyptus/15 blur-3xl'
			/>
			<div
				aria-hidden='true'
				className='absolute -right-48 bottom-20 h-96 w-96 rounded-full bg-deep-tidal-teal-100/40 blur-3xl'
			/>

			<div className='relative mx-auto max-w-7xl px-6'>
				<header className='grid gap-8 border-b border-deep-tidal-teal-800/15 pb-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-20 lg:pb-14'>
					<div>
						<p className='mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.24em] text-deep-tidal-teal-600'>
							<span className='h-px w-10 bg-deep-tidal-teal-500' />
							The collection
						</p>
						<h2
							id='alternative-products-title'
							className='max-w-3xl text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-deep-tidal-teal-800 sm:text-5xl lg:text-6xl'>
							Precision wellness,
							<span className='block font-medium text-deep-tidal-teal'>selected for you.</span>
						</h2>
					</div>
				</header>

				<div className='py-7 sm:py-9'>
					<div
						className='scrollbar-hide -mx-6 flex gap-2 overflow-x-auto px-6 pb-1'
						role='group'
						aria-label='Filter products by category'>
						{categories.map((category) => {
							const selected = category === selectedCategory;
							return (
								<button
									key={category}
									type='button'
									onClick={() => setSelectedCategory(category)}
									aria-pressed={selected}
									className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-bold transition ${
										selected
											? 'border-deep-tidal-teal bg-deep-tidal-teal text-white shadow-sm'
											: 'border-deep-tidal-teal-800/10 bg-white/65 text-deep-tidal-teal-700 hover:border-deep-tidal-teal/35 hover:bg-white'
									}`}>
									{category}
								</button>
							);
						})}
					</div>
				</div>

				<div
					id='product-collection'
					className='relative scroll-mt-28'>
					{showSkeleton && (
						<div className='grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-6'>
							{Array.from({ length: skeletonCount }).map((_, index) => (
								<div
									key={index}
									className='animate-pulse overflow-hidden rounded-xl border border-deep-tidal-teal/10 bg-white shadow-sm shadow-deep-tidal-teal/5'>
									<div className='aspect-square bg-[#f3f4f4]' />
									<div className='flex min-h-[15rem] flex-col gap-4 px-5 pb-5 pt-7 sm:px-6 sm:pb-6'>
										<div className='h-7 w-2/3 rounded bg-deep-tidal-teal/10' />
										<div className='h-4 w-1/2 rounded bg-deep-tidal-teal/10' />
										<div className='mt-auto h-12 rounded-lg bg-deep-tidal-teal/10' />
									</div>
								</div>
							))}
						</div>
					)}

					{visibleProducts.length > 0 ? (
						<div
							className={`grid grid-cols-1 gap-5 transition-opacity duration-300 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-6 ${showSkeleton ? 'pointer-events-none absolute inset-0 opacity-0' : 'opacity-100'}`}
							aria-hidden={showSkeleton}>
							{visibleProducts.map((product) => (
								<div key={product.id}>
									<ProductCardAlternative
										product={product}
										onImageLoaded={handleImageLoaded}
									/>
								</div>
							))}
						</div>
					) : isLoading ? null : (
						<div className='rounded-[1.75rem] border border-dashed border-deep-tidal-teal-800/20 bg-white/60 px-6 py-16 text-center'>
							<p className='text-lg font-bold text-deep-tidal-teal-800'>No products found in this category.</p>
							<button
								type='button'
								onClick={() => setSelectedCategory('All')}
								className='mt-3 text-sm font-bold text-deep-tidal-teal underline underline-offset-4'>
								View all products
							</button>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
