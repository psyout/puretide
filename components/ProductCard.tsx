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
	onImageLoaded?: (productId: string) => void;
}

export default function ProductCard({ product, onImageLoaded }: ProductCardProps) {
	const { addToCart } = useCart();
	const router = useRouter();
	const [isNavigating, setIsNavigating] = useState(false);
	const [showActions, setShowActions] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const [hasReportedImageLoaded, setHasReportedImageLoaded] = useState(false);
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

	useEffect(() => {
		setHasReportedImageLoaded(false);
	}, [product.id]);

	useEffect(() => {
		if (!onImageLoaded) return;
		if (hasReportedImageLoaded) return;
		if (hasProductImage(product.image)) return;
		onImageLoaded(product.id);
		setHasReportedImageLoaded(true);
	}, [hasReportedImageLoaded, onImageLoaded, product.id, product.image]);

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
				className='flex items-center justify-center gap-2 bg-soft-driftwood hover:bg-soft-driftwood-400 disabled:hover:bg-soft-driftwood disabled:cursor-not-allowed text-deep-tidal-teal-700 font-semibold py-2 px-3 rounded transition-colors cursor-pointer text-sm'>
				{isNavigating ? (
					<Loader2
						size={12}
						className='animate-spin'
					/>
				) : (
					<Eye size={12} />
				)}
				{isNavigating ? 'Loading...' : 'View'}
			</button>
			{!isSoldOut && (
				<button
					onClick={(e) => {
						e.preventDefault();
						addToCart(product);
					}}
					className='flex items-center justify-center gap-1 bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-2 px-4 rounded transition-colors cursor-pointer text-sm'>
					<ShoppingCart size={16} />
					Add to cart
				</button>
			)}
		</>
	);

	return (
		<div className='group bg-mineral-white-100 rounded-xl ui-border shadow-md relative flex flex-col hover:shadow-lg hover:shadow-deep-tidal-teal-500/10 transition-all duration-300 overflow-hidden'>
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
						<div className='relative w-56 h-56 md:w-52 md:h-52'>
							<Image
								src={product.image}
								alt={product.name}
								fill
								sizes='(max-width: 768px) 144px, 208px'
								unoptimized={product.image.startsWith('http')}
								className='object-contain w-auto h-auto'
								priority
								onLoad={() => {
									if (!onImageLoaded) return;
									if (hasReportedImageLoaded) return;
									onImageLoaded(product.id);
									setHasReportedImageLoaded(true);
								}}
								onError={() => {
									if (!onImageLoaded) return;
									if (hasReportedImageLoaded) return;
									onImageLoaded(product.id);
									setHasReportedImageLoaded(true);
								}}
							/>
						</div>
					) : (
						<ProductImagePlaceholder className='w-56 h-56 md:w-52 md:h-52' />
					)}
				</div>

				{/* Categories with icons - like product page */}
				{product.icons && product.icons.length > 0 && (
					<div className='flex flex-wrap gap-2 px-4 mt-2 md:hidden'>
						{product.icons.slice(0, 1).map((iconName: string) => {
							const Icon = iconMap[iconName];
							if (!Icon) {
								return null;
							}
							return (
								<div
									key={iconName}
									className='inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-eucalyptus-100'>
									<Icon className='w-4 h-4 text-deep-tidal-teal-700' />
									<span className='text-xs font-medium text-deep-tidal-teal-700'>{iconName}</span>
								</div>
							);
						})}
					</div>
				)}

				{/* Desktop icons - original style */}
				{product.icons && product.icons.length > 0 && (
					<div className='flex-wrap gap-[clamp(0.3rem,1.6vw,0.45rem)] ml-4 mt-2 hidden md:flex mb-1'>
						{product.icons.slice(0, 4).map((iconName: string) => {
							const Icon = iconMap[iconName];
							if (!Icon) return null;
							return (
								<span
									key={iconName}
									className='inline-flex items-center justify-center w-[clamp(2.1rem,8.4vw,2rem)] h-[clamp(2.1rem,8.4vw,2rem)] rounded-full bg-eucalyptus-100 text-deep-tidal-teal-700'
									title={iconName}>
									<Icon className='w-[1rem] h-[1rem] md:w-[1.1rem] md:h-[1.1rem]' />
								</span>
							);
						})}
					</div>
				)}
				{/* Mobile title and price */}
				<div className='px-4 mt-2 pb-3 md:px-6 md:pb-4 min-h-[90px]'>
					<h3 className='text-[clamp(1.1rem,4.8vw,0.9rem)] md:text-[clamp(1rem,2.3vw,1rem)] leading-[clamp(1.7rem,5.6vw,1.95rem)] md:leading-[clamp(1.6rem,2.8vw,1.8rem)] font-regular text-deep-tidal-teal-700 group-hover:text-deep-tidal-teal transition-colors line-clamp-2 text-wrap break-words hyphens-auto'>
						{product.name}
					</h3>
					{product.subtitle && <p className='text-xs text-deep-tidal-teal-600 mt-0.5 line-clamp-1'>({product.subtitle})</p>}
					<span className='text-lg md:text-lg font-semibold text-deep-tidal-teal inline-block'>
						<span className='text-md'>CAD$</span>
						{product.price.toFixed(2)}
					</span>
				</div>
			</Link>

			{/* Mobile: buttons only on tap (same as desktop hover) */}
			<div
				className={`absolute inset-0 md:hidden flex items-center justify-center gap-1 bg-white/40 transition-opacity duration-300 ${showActions ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}
				onClick={() => setShowActions(false)}>
				<div
					onClick={(e) => e.stopPropagation()}
					className='flex items-center gap-1'>
					{actionButtons}
				</div>
			</div>

			{/* Desktop: buttons only on hover (overlay) */}
			<div className='absolute inset-0 bg-white/40 opacity-0 transition-opacity duration-300 pointer-events-none group-hover:opacity-100 hidden md:block' />
			<div className='absolute inset-0 hidden md:flex items-center justify-center gap-2 opacity-0 transition-opacity duration-300 pointer-events-none group-hover:opacity-100 [&>*]:pointer-events-auto'>
				{actionButtons}
			</div>
		</div>
	);
}
