'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import ProductCard from './ProductCard';
import type { Product } from '@/types/product';

type ProductGridClientProps = {
	initialItems: Product[];
};

export default function ProductGridClient({ initialItems }: ProductGridClientProps) {
	const [selectedCategory, setSelectedCategory] = useState('All');
	const [items, setItems] = useState<Product[]>(initialItems);
	const [stockError, setStockError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(initialItems.length === 0);
	const [loadedImageIds, setLoadedImageIds] = useState<Set<string>>(new Set());
	const [imageGateExpired, setImageGateExpired] = useState(false);

	// 1. Fetch products from API
	useEffect(() => {
		let isMounted = true;

		const load = async () => {
			if (isMounted) setIsLoading(true);
			const controller = new AbortController();
			const timeoutId = window.setTimeout(() => controller.abort(), 8000);
			try {
				const response = await fetch('/api/stock', { cache: 'no-store', signal: controller.signal });
				if (!response.ok) {
					throw new Error(`Stock request failed: ${response.status}`);
				}
				const data = (await response.json()) as { ok: boolean; items?: Product[] };
				if (isMounted && data.ok && data.items) {
					const visibleItems = data.items.filter((product) => {
						const status = product.status ?? 'published';
						return status === 'published' || status === 'stock-out';
					});
					setItems(visibleItems);
					setStockError(null);
				} else if (isMounted && !data.ok) {
					setStockError('Couldn’t refresh stock. Showing cached data.');
				}
			} catch (error) {
				if (!isMounted) return;
				const isAbort = error instanceof DOMException && error.name === 'AbortError';
				setStockError(isAbort ? 'Stock request timed out. Showing cached data.' : 'Couldn’t refresh stock. Showing cached data.');
			} finally {
				window.clearTimeout(timeoutId);
				if (isMounted) setIsLoading(false);
			}
		};

		void load();
		const interval = window.setInterval(load, 60000);

		return () => {
			isMounted = false;
			window.clearInterval(interval);
		};
	}, []);

	// 3. Memoized categories and filtered products (Must be before useEffects that use them)
	const categories = useMemo(() => ['All', ...Array.from(new Set(items.map((product) => product.category)))], [items]);

	const filteredProducts = useMemo(() => {
		if (selectedCategory === 'All') {
			return items;
		}
		return items.filter((product) => product.category === selectedCategory);
	}, [selectedCategory, items]);

	const visibleProducts = filteredProducts;
	const expectedImageIds = useMemo(() => visibleProducts.map((p) => p.id), [visibleProducts]);
	const expectedImageIdsKey = useMemo(() => expectedImageIds.join('|'), [expectedImageIds]);

	useEffect(() => {
		setLoadedImageIds(new Set());
		setImageGateExpired(false);
	}, [expectedImageIdsKey]);

	useEffect(() => {
		if (expectedImageIds.length === 0) return;
		const timeout = window.setTimeout(() => {
			setImageGateExpired(true);
		}, 2500);
		return () => window.clearTimeout(timeout);
	}, [expectedImageIdsKey, expectedImageIds.length]);

	const handleImageLoaded = useCallback((productId: string) => {
		setLoadedImageIds((prev) => {
			if (prev.has(productId)) return prev;
			const next = new Set(prev);
			next.add(productId);
			return next;
		});
	}, []);

	const allImagesLoaded = useMemo(() => {
		if (expectedImageIds.length === 0) return true;
		return expectedImageIds.every((id) => loadedImageIds.has(id));
	}, [expectedImageIds, loadedImageIds]);

	const showSkeleton = isLoading || (visibleProducts.length > 0 && !imageGateExpired && !allImagesLoaded);
	const skeletonCount = useMemo(() => {
		if (visibleProducts.length > 0) return visibleProducts.length;
		if (initialItems.length > 0) return initialItems.length;
		return 6;
	}, [visibleProducts.length, initialItems.length]);

	return (
		<div
			id='products'
			className='relative left-1/2 right-1/2 w-screen -mx-[50vw] bg-cover bg-no-repeat pt-4 pb-24 scroll-mt-10'
			style={{ backgroundImage: "url('/background/products-bg.webp')" }}>
			<div className='absolute inset-0 bg-white/70' />
			<div className='relative mx-auto max-w-7xl px-6'>
				<div className='mb-5 mt-20'>
					<div className='text-center'>
						<h2 className='text-4xl font-bold text-deep-tidal-teal-800 mb-4'>Our Products</h2>
						<p className='text-deep-tidal-teal-700 text-base sm:text-lg max-w-lg mx-auto'>
							Discover our premium collection of wellness products, each crafted with precision and care.
						</p>
					</div>
				</div>

				{/* Category Filter - to make sticky, add: sticky top-[72px] z-20 bg-white/90 backdrop-blur-md shadow-sm */}
				<div className='py-4 -mx-6 px-6'>
					{/* Mobile Dropdown */}
					<div className='flex justify-center md:hidden'>
						<select
							value={selectedCategory}
							onChange={(e) => setSelectedCategory(e.target.value)}
							className='w-full max-w-xs bg-white rounded-full px-5 py-3 text-sm font-medium text-deep-tidal-teal-800 shadow-md border border-deep-tidal-teal/10 focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/30 appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2724%27%20height%3D%2724%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%232f3a3f%27%20stroke-width%3D%272%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cpolyline%20points%3D%276%209%2012%2015%2018%209%27%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")] bg-[length:20px] bg-[right_12px_center] bg-no-repeat'>
							{categories.map((category) => (
								<option
									key={category}
									value={category}>
									{category}
								</option>
							))}
						</select>
					</div>

					{/* Tablet/Desktop Pills */}
					<div className='hidden md:flex justify-center'>
						<div className='inline-flex bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-md border border-deep-tidal-teal/10 overflow-x-auto max-w-full scrollbar-hide'>
							<div className='flex gap-1'>
								{categories.map((category) => (
									<button
										key={category}
										onClick={() => setSelectedCategory(category)}
										className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
											selectedCategory === category ? 'bg-deep-tidal-teal text-white shadow-sm' : 'text-deep-tidal-teal-700 hover:bg-deep-tidal-teal-50'
										}`}>
										{category}
									</button>
								))}
							</div>
						</div>
					</div>
				</div>

				{stockError && (
					<p
						className='text-center text-sm text-deep-tidal-teal-600/80 mb-2'
						role='status'>
						{stockError}
					</p>
				)}
				<div>
					<div className='relative mt-8'>
						{showSkeleton && (
							<div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-10'>
								{Array.from({ length: skeletonCount }).map((_, index) => (
									<div
										key={index}
										className='bg-mineral-white-100 rounded-xl ui-border shadow-md animate-pulse relative flex flex-col overflow-hidden'>
										{/* Image placeholder */}
										<div className='m-4 md:m-5 rounded-lg bg-eucalyptus-50/60 min-h-[10rem] md:min-h-[12rem] flex justify-center items-center'>
											<div className='w-56 h-56 md:w-52 md:h-52 rounded-lg bg-deep-tidal-teal/10' />
										</div>

										{/* Content placeholder */}
										<div className='px-4 mt-2 pb-3 md:px-6 md:pb-4 min-h-[90px]'>
											<div className='h-6 bg-deep-tidal-teal/15 rounded w-3/4 mb-2' />
											<div className='h-4 bg-deep-tidal-teal/10 rounded w-1/2 mb-2' />
											<div className='h-6 bg-deep-tidal-teal/15 rounded w-20' />
										</div>
									</div>
								))}
							</div>
						)}
						{visibleProducts.length > 0 ? (
							<div
								className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-10 transition-opacity duration-300 ${
									showSkeleton ? 'opacity-0 pointer-events-none select-none' : 'opacity-100'
								}`}
								aria-hidden={showSkeleton}>
								{visibleProducts.map((product) => (
									<div key={product.id}>
										<ProductCard
											product={product}
											onImageLoaded={handleImageLoaded}
										/>
									</div>
								))}
							</div>
						) : isLoading ? null : (
							<div className='text-center py-12'>
								<p className='text-deep-tidal-teal-700 text-lg'>No products found in this category.</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
