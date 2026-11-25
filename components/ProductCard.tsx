'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, CircleAlert, Eye, Loader2, ShoppingCart } from 'lucide-react';
import type { Product, PromoCode } from '@/types/product';
import { getSalePrice } from '@/lib/promo';
import { useCart } from '@/context/CartContext';
import { iconMap } from '@/lib/productIcons';
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';
import { isProductVariantSellable } from '@/lib/productVariant';

type ProductCardProps = {
	product: Product;
	onImageLoaded?: (productId: string) => void;
	automaticPromotion?: PromoCode | null;
};

export default function ProductCard({ product, onImageLoaded, automaticPromotion }: ProductCardProps) {
	const { addToCart } = useCart();
	const [hasReportedImageLoaded, setHasReportedImageLoaded] = useState(false);
	const [justAdded, setJustAdded] = useState(false);
	const [isNavigating, setIsNavigating] = useState(false);
	const variants = product.variants ?? [];
	const hasVariants = variants.length > 1;
	const subtitleIsStrengthRange = hasVariants && /^\s*\d+(?:\.\d+)?\s*(?:mg|mcg|g)\s*[–—-]\s*\d+(?:\.\d+)?\s*(?:mg|mcg|g)\s*$/i.test(product.subtitle ?? '');
	const defaultVariant = hasVariants ? (variants.find(isProductVariantSellable) ?? variants[0]) : null;
	const [selectedVariantKey, setSelectedVariantKey] = useState<string | null>(defaultVariant?.key ?? null);
	const selectedVariant = variants.find((variant) => variant.key === selectedVariantKey) ?? defaultVariant;
	const isSoldOut = selectedVariant ? !isProductVariantSellable(selectedVariant) : Number(product.stock) <= 0 || product.status === 'stock-out';
	const isLowStock = !isSoldOut && Number(selectedVariant?.stock ?? product.stock) < 10;
	const selectedPrice = selectedVariant?.price ?? product.price;
	const selectedImage = selectedVariant?.image || product.image;
	const productHref = `/product/${product.slug}${selectedVariant ? `?variant=${encodeURIComponent(selectedVariant.key)}` : ''}`;
	const primaryIconName = product.icons?.[0];
	const PrimaryIcon = primaryIconName ? iconMap[primaryIconName] : null;
	const saleDiscount = automaticPromotion?.discount ?? 0;

	useEffect(() => {
		setHasReportedImageLoaded(false);
		setJustAdded(false);
		setSelectedVariantKey(defaultVariant?.key ?? null);
	}, [product.id, defaultVariant?.key]);

	useEffect(() => {
		if (!onImageLoaded || hasReportedImageLoaded || hasProductImage(product.image)) return;
		onImageLoaded(product.id);
		setHasReportedImageLoaded(true);
	}, [hasReportedImageLoaded, onImageLoaded, product.id, product.image]);

	const reportImageLoaded = () => {
		if (!onImageLoaded || hasReportedImageLoaded) return;
		onImageLoaded(product.id);
		setHasReportedImageLoaded(true);
	};

	const handleAdd = () => {
		if (isSoldOut || justAdded) return;
		if (selectedVariant) {
			addToCart({
				...product,
				id: selectedVariant.key,
				price: selectedVariant.price,
				stock: selectedVariant.stock,
				mg: selectedVariant.label,
				image: selectedImage,
				subtitle: selectedVariant.subtitle ?? product.subtitle,
				zohoItemId: selectedVariant.zohoItemId,
				sku: selectedVariant.sku,
				cost: selectedVariant.cost,
			});
		} else {
			addToCart(product);
		}
		setJustAdded(true);
		window.setTimeout(() => setJustAdded(false), 1800);
	};

	const handleDetailsClick = (event: MouseEvent<HTMLAnchorElement>) => {
		if (isNavigating) {
			event.preventDefault();
			return;
		}

		setIsNavigating(true);
	};

	return (
		<article className='bento-card bento-card-interactive group relative isolate flex h-auto flex-col overflow-hidden lg:h-full'>
			<Link
				href={productHref}
				aria-label={`View ${product.name}`}
				className='absolute inset-0 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-tidal-teal focus-visible:ring-offset-2'
			/>

			<div className='relative flex h-44 items-center justify-center overflow-hidden bg-[#f3f4f4] min-[400px]:h-auto min-[400px]:aspect-square'>
				{saleDiscount > 0 && (
					<span className='absolute right-2 top-2 z-20 rounded-full bg-deep-tidal-teal px-2 py-1 text-[10px] font-bold text-white sm:right-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-xs'>
						{saleDiscount}% OFF
					</span>
				)}
				{primaryIconName && PrimaryIcon && (
					<span className='absolute left-2 top-2 inline-flex max-w-[52%] items-center gap-1 rounded-full bg-eucalyptus-100 px-2 py-1 text-[10px] font-medium text-deep-tidal-teal-700 sm:left-4 sm:top-4 sm:max-w-none sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs'>
						<PrimaryIcon
							className='h-3 w-3 shrink-0 text-deep-tidal-teal-700 sm:h-4 sm:w-4'
							stroke={1.6}
						/>
						<span className='truncate'>{primaryIconName}</span>
					</span>
				)}
				{(isLowStock || isSoldOut) && (
					<span
						className={`absolute bottom-2 left-2 z-20 inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-semibold shadow-sm backdrop-blur-sm sm:bottom-4 sm:left-4 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs ${
							isSoldOut ? 'bg-deep-tidal-teal-800/95 text-white' : 'bg-white/90 text-amber-700'
						}`}>
						<CircleAlert
							className='h-3.5 w-3.5 sm:h-4 sm:w-4'
							strokeWidth={2}
						/>
						{isSoldOut ? 'Sold out' : 'Low stock'}
					</span>
				)}
				{hasProductImage(selectedImage) ? (
					<div className='relative h-[74%] w-[74%] min-[400px]:h-[64%] min-[400px]:w-[64%]'>
						<Image
							src={selectedImage}
							alt={product.name}
							fill
							sizes='(max-width: 640px) 42vw, (max-width: 1024px) 32vw, 16vw'
							unoptimized={selectedImage.startsWith('http')}
							className='object-contain'
							onLoad={reportImageLoaded}
							onError={reportImageLoaded}
						/>
					</div>
				) : (
					<ProductImagePlaceholder className='h-[74%] w-[74%] min-[400px]:h-[64%] min-[400px]:w-[64%]' />
				)}
			</div>

			<div className='flex min-w-0 flex-col px-3 pb-3 pt-3 lg:min-h-[13rem] lg:flex-1 lg:px-4 lg:pb-4 lg:pt-4'>
				<div className='min-w-0'>
					<h3 className='line-clamp-2 text-[1.05rem] font-semibold leading-[1.25] text-deep-tidal-teal-700 transition-colors group-hover:text-deep-tidal-teal min-[400px]:text-[0.95rem] min-[680px]:text-base'>
						{product.name}
					</h3>
					{product.subtitle && !subtitleIsStrengthRange && (
						<p className='mb-1 mt-1 line-clamp-2 text-[0.75rem] font-medium leading-normal text-deep-tidal-teal-600 min-[400px]:text-[0.75rem] min-[680px]:text-[0.8rem]'>
							{product.subtitle}
						</p>
					)}
					{hasVariants && (
						<fieldset className='relative z-20 mt-2 flex flex-wrap gap-1'>
							<legend className='sr-only'>Select strength for {product.name}</legend>
							{variants.map((variant) => {
								const isSelected = selectedVariant?.key === variant.key;
								const isUnavailable = !isProductVariantSellable(variant);
								return (
									<label
										key={variant.key}
										className={`inline-flex min-h-6 min-w-[3rem] items-center justify-center rounded-full border px-1.5 text-xs font-semibold transition-colors focus-within:ring-2 focus-within:ring-deep-tidal-teal/40 ${isSelected ? 'border-deep-tidal-teal-700 bg-deep-tidal-teal-700 text-white' : 'border-deep-tidal-teal/25 bg-white text-deep-tidal-teal-800 hover:bg-eucalyptus-50'} ${isUnavailable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
										<input
											type='radio'
											name={`card-strength-${product.id}`}
											value={variant.key}
											checked={isSelected}
											onChange={() => {
												setSelectedVariantKey(variant.key);
												setJustAdded(false);
											}}
											disabled={isUnavailable}
											className='sr-only'
										/>
										{variant.label}
										{isUnavailable && <span className='sr-only'> (sold out)</span>}
									</label>
								);
							})}
						</fieldset>
					)}
				</div>

				<div className='mt-2 border-t border-deep-tidal-teal-800/15 pt-2.5 sm:mt-3 sm:pt-3 lg:mt-auto'>
					<div className='flex flex-col items-start gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4'>
						<div className='space-y-0.5'>
							{saleDiscount > 0 && <p className='text-xs text-deep-tidal-teal-500 line-through sm:text-sm'>${selectedPrice.toFixed(2)} CAD</p>}
							<p className={`text-[0.95rem] font-semibold leading-tight sm:text-[1.05rem] ${saleDiscount > 0 ? 'text-[#b42318]' : 'text-deep-tidal-teal-700'}`}>
								${getSalePrice(selectedPrice, saleDiscount).toFixed(2)} CAD
							</p>
						</div>
					</div>

					<div className='relative z-20 mt-3 grid grid-cols-[minmax(0,1fr)_2.5rem] gap-2 sm:mt-4 sm:grid-cols-[minmax(0,1fr)_3rem]'>
						<Link
							href={productHref}
							onClick={handleDetailsClick}
							aria-disabled={isNavigating}
							className={`site-cta cta-secondary min-h-10 whitespace-nowrap px-2 py-2 text-sm normal-case tracking-normal sm:min-h-12 sm:px-4 ${isNavigating ? 'cursor-wait opacity-70' : ''}`}>
							{isNavigating ? (
								<Loader2
									className='h-4 w-4 animate-spin'
									aria-hidden='true'
								/>
							) : (
								<Eye className='hidden h-4 w-4 sm:block' />
							)}
							<span>More details</span>
						</Link>
						<button
							type='button'
							onClick={handleAdd}
							disabled={isSoldOut}
							aria-pressed={justAdded}
							aria-live='polite'
							aria-label={justAdded ? `${product.name} added to cart` : isSoldOut ? `${product.name} is unavailable` : `Add ${product.name} to cart`}
							className={`site-cta min-h-10 w-10 p-0 sm:min-h-12 sm:w-12 ${justAdded ? 'border-eucalyptus-500 bg-eucalyptus-500 text-white shadow-[0_0_0_3px_rgba(106,184,147,0.22)]' : 'cta-primary'}`}>
							{justAdded ? <Check className='h-4 w-4' /> : isSoldOut ? <Loader2 className='h-4 w-4' /> : <ShoppingCart className='h-4 w-4' />}
							<span className='sr-only'>{justAdded ? 'Added' : isSoldOut ? 'Unavailable' : 'Add to cart'}</span>
						</button>
					</div>
				</div>
			</div>
		</article>
	);
}
