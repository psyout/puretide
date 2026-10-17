'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Product } from '@/types/product';
import { useCart } from '@/context/CartContext';
import { isProductFilterCategory, PRODUCT_CATEGORY_EVENT, PRODUCT_FILTER_CATEGORIES, type ProductFilterCategory } from '@/lib/productCategories';
import ProductCardAlternative from './ProductCardAlternative';

type ProductGridAlternativeClientProps = {
	initialItems: Product[];
	stockUnavailable?: boolean;
};

function getFilterCategory(category: string): ProductFilterCategory {
	const normalized = category.trim().toLowerCase();
	if (normalized === 'metabolic') return 'Metabolic';
	if (['stack', 'stacks', 'blend', 'blends'].includes(normalized)) return 'Stack';
	if (normalized === 'recovery') return 'Recovery';
	if (['longevity', 'immune', 'antioxidant', 'intimacy', 'sexual health'].includes(normalized)) return 'Longevity';
	if (normalized === 'cognitive') return 'Cognitive';
	if (['supplies', 'supply', 'accessory', 'accessories', 'hydration'].includes(normalized)) return 'Supplies';
	return 'Features';
}

export default function ProductGridAlternativeClient({ initialItems, stockUnavailable = false }: ProductGridAlternativeClientProps) {
	const { automaticPromotion } = useCart();
	const [selectedCategory, setSelectedCategory] = useState<ProductFilterCategory>('All');
	const [searchQuery, setSearchQuery] = useState('');
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

	useEffect(() => {
		const selectCategoryFromUrl = () => {
			const category = new URLSearchParams(window.location.search).get('category');
			if (isProductFilterCategory(category)) setSelectedCategory(category);
		};
		const handleCategorySelection = (event: Event) => {
			const category = (event as CustomEvent<{ category?: string }>).detail?.category ?? null;
			if (isProductFilterCategory(category)) setSelectedCategory(category);
		};

		selectCategoryFromUrl();
		window.addEventListener(PRODUCT_CATEGORY_EVENT, handleCategorySelection);
		return () => window.removeEventListener(PRODUCT_CATEGORY_EVENT, handleCategorySelection);
	}, []);

	const visibleProducts = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		return items.filter((product) => {
			const matchesCategory = selectedCategory === 'All' || getFilterCategory(product.category) === selectedCategory;
			if (!matchesCategory) return false;
			if (!query) return true;
			return [product.name, product.subtitle, product.description, product.mg, product.category, ...(product.icons ?? [])]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(query));
		});
	}, [items, searchQuery, selectedCategory]);
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
				<header className='grid gap-8 pb-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-20 lg:pb-1'>
					<div>
						<p className='mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.24em] text-deep-tidal-teal-600'>
							<span className='h-px w-3 bg-deep-tidal-teal-500' />
							The collection
						</p>
					</div>
				</header>

				<div className='py-7 sm:py-9'>
					<div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
						<div className='relative w-full lg:order-2 lg:max-w-[22rem]'>
							<label htmlFor='product-search' className='sr-only'>Search products</label>
							<Search className='pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-deep-tidal-teal-500' aria-hidden='true' />
							<input
								id='product-search'
								type='search'
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								placeholder='Search products'
								autoComplete='off'
								className='h-11 w-full rounded-full border border-deep-tidal-teal-800/15 bg-white/85 py-2 pl-11 pr-11 text-sm font-medium text-deep-tidal-teal-900 shadow-sm outline-none transition placeholder:text-deep-tidal-teal-500 focus:border-deep-tidal-teal/45 focus:ring-4 focus:ring-deep-tidal-teal/10'
							/>
							{searchQuery && (
								<button type='button' onClick={() => setSearchQuery('')} aria-label='Clear product search' className='absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-deep-tidal-teal-500 transition hover:bg-deep-tidal-teal/10 hover:text-deep-tidal-teal-800'>
									<X className='h-4 w-4' />
								</button>
							)}
						</div>

						<div className='min-w-0 lg:order-1 lg:flex-1'>
							<div className='scrollbar-hide -mx-6 flex gap-2 overflow-x-auto px-6 pb-1 lg:mx-0 lg:justify-start lg:px-0' role='group' aria-label='Filter products by category'>
								{PRODUCT_FILTER_CATEGORIES.map((category) => {
									const selected = category === selectedCategory;
									return (
										<button
											key={category}
											type='button'
											onClick={() => setSelectedCategory(category)}
											aria-pressed={selected}
											className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-bold transition ${selected ? 'border-deep-tidal-teal bg-deep-tidal-teal text-white shadow-sm' : 'border-deep-tidal-teal-800/10 bg-white/65 text-deep-tidal-teal-700 hover:border-deep-tidal-teal/35 hover:bg-white'}`}>
											{category}
										</button>
									);
								})}
							</div>
						</div>
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
										automaticPromotion={automaticPromotion}
									/>
								</div>
							))}
						</div>
					) : isLoading ? null : (
						<div className='rounded-[1.75rem] border border-dashed border-deep-tidal-teal-800/20 bg-white/60 px-6 py-16 text-center'>
							<p className='text-lg font-bold text-deep-tidal-teal-800'>No products match your filters.</p>
							<button
								type='button'
								onClick={() => {
									setSelectedCategory('All');
									setSearchQuery('');
								}}
								className='mt-3 text-sm font-bold text-deep-tidal-teal underline underline-offset-4'>
								Clear filters
							</button>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
