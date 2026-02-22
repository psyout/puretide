'use client';

import { useState } from 'react';
import { Product } from '@/types/product';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { Eye, ShoppingCart, Loader2 } from 'lucide-react';

interface ProductCardProps {
	product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
	const { addToCart } = useCart();
	const router = useRouter();
	const [isNavigating, setIsNavigating] = useState(false);
	const stock = Number(product.stock) || 0;
	const isSoldOut = stock <= 0 || product.status === 'stock-out';
	const isLowStock = !isSoldOut && stock < 10;

	const handleViewClick = (e: React.MouseEvent) => {
		e.preventDefault();
		if (isNavigating) return;
		setIsNavigating(true);
		router.push(`/product/${product.slug}`);
	};

	return (
		<div className='group bg-mineral-white backdrop-blur-sm rounded-xl ui-border hover:shadow-xl hover:shadow-deep-tidal-teal-500/20 transition-colors duration-300 overflow-hidden shadow-sm relative'>
			{isSoldOut && <span className='absolute top-4 right-4 text-xs font-semibold uppercase tracking-wide bg-deep-tidal-teal text-mineral-white px-2 py-1 rounded-md z-10'>Sold out</span>}
			{isLowStock && (
				<span className='absolute top-4 right-4 text-xs font-semibold uppercase tracking-wide bg-deep-tidal-teal-200 text-mineral-white px-2 py-1 rounded-md z-10'>Low stock</span>
			)}
			<Link href={`/product/${product.slug}`}>
				<div className='p-6 cursor-pointer'>
					<div className='mb-6 text-center duration-300 flex justify-center items-center h-56'>
						{product.image.startsWith('/') || product.image.startsWith('http') ? (
							<div className='relative h-52 w-52'>
								<Image
									src={product.image}
									alt={product.name}
									fill
									sizes='208px'
									unoptimized={product.image.startsWith('http')}
									className='object-contain drop-shadow-xl drop-shadow-red'
									priority
								/>
							</div>
						) : (
							<span
								className='text-5xl'
								style={{ width: 'auto', height: 'auto' }}>
								{product.image}
							</span>
						)}
					</div>
					<div className='flex items-start gap-2'>
						<h3 className='text-xl font-extrabold text-deep-tidal-teal-700 group-hover:text-deep-tidal-teal transition-colors'>{product.name}</h3>
						{product.mg && !product.name.toLowerCase().includes('stack') && <span className='text-deep-tidal-teal-600 font-bold text-sm mt-0.5'>{product.mg}mg</span>}
					</div>
					{product.subtitle && <p className='text-sm text-deep-tidal-teal-700 font-light -mt-1'>({product.subtitle})</p>}
					<p className='text-deep-tidal-teal-700 text-sm mb-6 line-clamp-2 mt-2'>{product.description}</p>
					<div className='flex justify-between items-center'>
						<span className='text-2xl font-bold text-deep-tidal-teal'>${product.price.toFixed(2)}</span>
					</div>
				</div>
			</Link>
			<div className='absolute inset-0 bg-white/30 backdrop-blur-[2px] opacity-0 transition-opacity duration-300 pointer-events-none group-hover:opacity-100' />
			<div className='absolute inset-0 flex items-center justify-center gap-3 opacity-0 transition-opacity duration-300 pointer-events-none group-hover:opacity-100 flex-col md:flex-row'>
				<button
					onClick={handleViewClick}
					disabled={isNavigating}
					className='pointer-events-auto flex items-center gap-2 bg-soft-driftwood hover:bg-soft-driftwood-400 disabled:opacity-70 disabled:cursor-not-allowed text-deep-tidal-teal-700 font-semibold py-3 px-4 rounded transition-colors cursor-pointer'>
					{isNavigating ? (
						<Loader2
							size={18}
							className='animate-spin'
						/>
					) : (
						<Eye size={18} />
					)}
					{isNavigating ? 'Loading...' : 'View'}
				</button>
				{!isSoldOut && (
					<button
						onClick={(e) => {
							e.preventDefault();
							addToCart(product);
						}}
						className='pointer-events-auto flex items-center gap-2 bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors cursor-pointer'>
						<ShoppingCart size={18} />
						Add to cart
					</button>
				)}
			</div>
		</div>
	);
}
