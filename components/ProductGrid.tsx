'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { products } from '@/lib/products';
import ProductCard from './ProductCard';

const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];

export default function ProductGrid() {
	const [selectedCategory, setSelectedCategory] = useState('All');
	const [visibleCount, setVisibleCount] = useState(6);
	const loadMoreRef = useRef<HTMLDivElement | null>(null);

	const filteredProducts = useMemo(() => {
		if (selectedCategory === 'All') {
			return products;
		}
		return products.filter((product) => product.category === selectedCategory);
	}, [selectedCategory]);

	useEffect(() => {
		setVisibleCount(6);
	}, [selectedCategory]);

	useEffect(() => {
		if (!loadMoreRef.current) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					setVisibleCount((count) => Math.min(count + 6, filteredProducts.length));
				}
			},
			{ rootMargin: '200px 0px' }
		);

		observer.observe(loadMoreRef.current);
		return () => observer.disconnect();
	}, [filteredProducts.length]);

	const visibleProducts = filteredProducts.slice(0, visibleCount);

	return (
		<div
			id='products'
			className='relative left-1/2 right-1/2 w-screen -mx-[50vw] bg-cover bg-top bg-no-repeat py-20 scroll-mt-10'
			style={{ backgroundImage: "url('/background/08.jpg')" }}>
			<div className='absolute inset-0 bg-white/70' />
			<div className='relative mx-auto max-w-6xl px-10'>
				<div className='mb-12 mt-20'>
					<div className='text-center'>
						<h2 className='text-4xl font-bold text-deep-tidal-teal-800 mb-4'>Our Products</h2>
						<p className='text-deep-tidal-teal-700 text-lg max-w-2xl mx-auto'>Discover our premium collection of wellness products, each crafted with precision and care.</p>
					</div>

					{/* Filter Section */}
					<div className='mt-6 flex flex-wrap justify-center gap-4'>
						{categories.map((category) => (
							<button
								key={category}
								onClick={() => setSelectedCategory(category)}
								className={`px-6 py-2 rounded-lg font-semibold transition-all duration-300 bg-deep-tidal-teal text-white-800 shadow-lg ${
									selectedCategory === category ? 'bg-deep-tidal-teal text-mineral-white shadow-lg' : 'bg-white text-deep-tidal-teal-800 hover:bg-eucalyptus-200'
								}`}>
								{category}
							</button>
						))}
					</div>
				</div>

				{/* Products Grid */}
				<div>
					<div className='grid grid-cols-1 md:grid-cols-3 gap-10'>
						{visibleProducts.length > 0 ? (
							visibleProducts.map((product) => (
								<ProductCard
									key={product.id}
									product={product}
								/>
							))
						) : (
							<div className='col-span-2 text-center py-12'>
								<p className='text-deep-tidal-teal-700 text-lg'>No products found in this category.</p>
							</div>
						)}
					</div>
					{visibleCount < filteredProducts.length && (
						<div
							ref={loadMoreRef}
							className='h-10'
						/>
					)}
				</div>
			</div>
		</div>
	);
}
