'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/types/product';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { iconMap } from '@/lib/productIcons';
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';
import { Eye, ShoppingCart, Loader2 } from 'lucide-react';

interface ProductCardProps {
	product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
	const { addToCart } = useCart();
	const router = useRouter();
	const [isNavigating, setIsNavigating] = useState(false);
	const [showActions, setShowActions] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const stock = Number(product.stock) || 0;
	const isSoldOut = stock <= 0 || product.status === 'stock-out';
	const isLowStock = !isSoldOut && stock < 10;

	useEffect(() => {
		const m = window.matchMedia('(max-width: 767px)');
		setIsMobile(m.matches);
		const fn = () => setIsMobile(m.matches);
		m.addEventListener('change', fn);
		return () => m.removeEventListener('change', fn);
	}, []);

	const handleViewClick = (e: React.MouseEvent) => {
		e.preventDefault();
		if (isNavigating) return;
		setIsNavigating(true);
		router.push(`/product/${product.slug}`);
	};

	const actionButtons = (
		<>
			<button
				onClick={handleViewClick}
				disabled={isNavigating}
				className='flex items-center justify-center gap-2 bg-soft-driftwood hover:bg-soft-driftwood-400 disabled:opacity-70 disabled:cursor-not-allowed text-deep-tidal-teal-700 font-semibold py-3 px-4 rounded transition-colors cursor-pointer'>
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
					className='flex items-center justify-center gap-2 bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors cursor-pointer'>
					<ShoppingCart size={18} />
					Add to cart
				</button>
			)}
		</>
	);

	return (
		<div className='group bg-mineral-white rounded-xl ui-border shadow-sm relative flex flex-col hover:shadow-lg hover:shadow-deep-tidal-teal-500/10 transition-all duration-300 overflow-hidden'>
			{isSoldOut && <span className='absolute top-3 right-3 z-10 text-xs font-semibold uppercase tracking-wide bg-deep-tidal-teal text-mineral-white px-2 py-1 rounded-md'>Sold out</span>}
			{isLowStock && !isSoldOut && (
				<span className='absolute top-3 right-3 z-10 text-xs font-semibold uppercase tracking-wide bg-deep-tidal-teal-200 text-mineral-white px-2 py-1 rounded-md'>Low stock</span>
			)}

			<Link
				href={`/product/${product.slug}`}
				className='flex flex-1 min-h-0 flex-col'
				onClick={(e) => {
					if (isMobile && !showActions) {
						e.preventDefault();
						setShowActions(true);
					}
				}}>
				{/* Image – framed area with even padding */}
				<div className='m-4 md:m-5 rounded-lg bg-eucalyptus-50/60 flex justify-center items-center min-h-[10rem] md:min-h-[12rem]'>
					{hasProductImage(product.image) ? (
						<div className='relative w-36 h-36 md:w-52 md:h-52'>
							<Image
								src={product.image}
								alt={product.name}
								fill
								sizes='(max-width: 768px) 144px, 208px'
								unoptimized={product.image.startsWith('http')}
								className='object-contain'
								priority
							/>
						</div>
					) : (
						<ProductImagePlaceholder className='w-36 h-36 md:w-52 md:h-52' />
					)}
				</div>
				{/* Content – title, description, icons, price */}
				<div className='px-4 pb-3 md:px-6 md:pb-4'>
					<h3 className='text-xl md:text-xl font-bold text-deep-tidal-teal-700 group-hover:text-deep-tidal-teal transition-colors line-clamp-2'>{product.name}</h3>
					{product.subtitle && <p className='text-xs text-deep-tidal-teal-600 mt-0.5 line-clamp-1'>({product.subtitle})</p>}
					{product.description && <p className='text-[14px] text-deep-tidal-teal-600 mt-2 line-clamp-2 leading-relaxed'>{product.description}</p>}
					{product.icons && product.icons.length > 0 && (
						<div className='flex flex-wrap gap-1.5 mt-2'>
							{product.icons.slice(0, 4).map((iconName: string) => {
								const Icon = iconMap[iconName];
								if (!Icon) return null;
								return (
									<span
										key={iconName}
										className='inline-flex items-center justify-center w-7 h-7 rounded-full bg-eucalyptus-100 text-deep-tidal-teal-700'
										title={iconName}>
										<Icon className='w-3.5 h-3.5' />
									</span>
								);
							})}
						</div>
					)}
					<div className='mt-3'>
						<span className='text-3xl md:text-2xl font-bold text-deep-tidal-teal'>${product.price.toFixed(2)}</span>
					</div>
				</div>
			</Link>

			{/* Mobile: buttons only on tap (same as desktop hover) */}
			<div
				className={`absolute inset-0 md:hidden flex items-center justify-center gap-3 bg-white/40 transition-opacity duration-300 ${showActions ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}
				onClick={() => setShowActions(false)}>
				<div
					onClick={(e) => e.stopPropagation()}
					className='flex items-center gap-2'>
					{actionButtons}
				</div>
			</div>

			{/* Desktop: buttons only on hover (overlay) */}
			<div className='absolute inset-0 bg-white/40 opacity-0 transition-opacity duration-300 pointer-events-none group-hover:opacity-100 hidden md:block' />
			<div className='absolute inset-0 hidden md:flex items-center justify-center gap-3 opacity-0 transition-opacity duration-300 pointer-events-none group-hover:opacity-100 [&>*]:pointer-events-auto'>
				{actionButtons}
			</div>
		</div>
	);
}
