'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, CircleAlert, Eye, Loader2 } from 'lucide-react';
import type { Product, PromoCode } from '@/types/product';
import { getSalePrice } from '@/lib/promo';
import { useCart } from '@/context/CartContext';
import { iconMap } from '@/lib/productIcons';
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';
import { isProductVariantSellable } from '@/lib/productVariant';

type ProductCardAlternativeProps = {
	product: Product;
	onImageLoaded?: (productId: string) => void;
	automaticPromotion?: PromoCode | null;
};

function getProductPrice(product: Product, discount = 0) {
	const variants = product.variants ?? [];
	if (variants.length <= 1) return getSalePrice(product.price, discount).toFixed(2);

	const prices = variants.map((variant) => getSalePrice(variant.price, discount));
	const min = Math.min(...prices);
	const max = Math.max(...prices);
	return min === max ? min.toFixed(2) : `${min.toFixed(2)} – ${max.toFixed(2)}`;
}

export default function ProductCardAlternative({ product, onImageLoaded, automaticPromotion }: ProductCardAlternativeProps) {
	const { addToCart } = useCart();
	const [hasReportedImageLoaded, setHasReportedImageLoaded] = useState(false);
	const [justAdded, setJustAdded] = useState(false);
	const [isCardHovered, setIsCardHovered] = useState(false);
	const variants = product.variants ?? [];
	const hasVariants = variants.length > 1;
	const allVariantsSoldOut = hasVariants && variants.every((variant) => !isProductVariantSellable(variant));
	const isSoldOut = allVariantsSoldOut || (!hasVariants && (Number(product.stock) <= 0 || product.status === 'stock-out'));
	const isLowStock = !isSoldOut && !hasVariants && Number(product.stock) < 10;
	const defaultVariant = hasVariants ? (variants.find(isProductVariantSellable) ?? variants[0]) : null;
	const optionLabel = defaultVariant?.label || product.mg;
	const primaryIconName = product.icons?.[0];
	const PrimaryIcon = primaryIconName ? iconMap[primaryIconName] : null;
	const saleDiscount = automaticPromotion?.discount ?? 0;

	useEffect(() => {
		setHasReportedImageLoaded(false);
		setJustAdded(false);
	}, [product.id]);

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
		if (isSoldOut) return;
		if (defaultVariant) {
			addToCart({
				...product,
				id: defaultVariant.key,
				price: defaultVariant.price,
				stock: defaultVariant.stock,
				mg: defaultVariant.label,
				image: defaultVariant.image || product.image,
				subtitle: defaultVariant.subtitle ?? product.subtitle,
				zohoItemId: defaultVariant.zohoItemId,
				sku: defaultVariant.sku,
				cost: defaultVariant.cost,
			});
		} else {
			addToCart(product);
		}
		setJustAdded(true);
		window.setTimeout(() => setJustAdded(false), 1400);
	};

	return (
		<article
			onMouseEnter={() => setIsCardHovered(true)}
			onMouseLeave={() => setIsCardHovered(false)}
			className='bento-card bento-card-interactive group relative isolate flex h-full flex-col overflow-hidden'>
			<Link
				href={`/product/${product.slug}`}
				aria-label={`View ${product.name}`}
				className='absolute inset-0 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-tidal-teal focus-visible:ring-offset-2'
			/>

			<div className='relative flex aspect-square items-center justify-center overflow-hidden bg-[#f3f4f4]'>
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
				<Link
					href={`/product/${product.slug}`}
					aria-hidden={!isCardHovered}
					tabIndex={isCardHovered ? 0 : -1}
					className={`absolute bottom-4 right-4 z-20 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-soft-driftwood px-4 py-2 text-sm font-semibold text-deep-tidal-teal-700 shadow-[0_8px_22px_rgba(10,32,39,0.2)] transition-opacity duration-200 hover:bg-soft-driftwood-400 ${
						isCardHovered ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
					}`}>
					<Eye className='h-4 w-4' />
					View
				</Link>
				{hasProductImage(product.image) ? (
					<div className='relative h-[64%] w-[64%]'>
						<Image
							src={product.image}
							alt={product.name}
							fill
							sizes='(max-width: 640px) 42vw, (max-width: 1024px) 32vw, 16vw'
							unoptimized={product.image.startsWith('http')}
							className='object-contain'
							onLoad={reportImageLoaded}
							onError={reportImageLoaded}
						/>
					</div>
				) : (
					<ProductImagePlaceholder className='h-[64%] w-[64%]' />
				)}
			</div>

			<div className='flex min-h-[11.5rem] min-w-0 flex-1 flex-col px-3 pb-3 pt-3 sm:min-h-[13rem] sm:px-6 sm:pb-6 sm:pt-4'>
				<div className='min-w-0'>
					<h3 className='line-clamp-2 text-base font-semibold leading-[1.25] text-deep-tidal-teal-700 transition-colors group-hover:text-deep-tidal-teal min-[351px]:text-[clamp(0.875rem,3.75vw,1rem)] sm:text-base'>
						{product.name}
					</h3>
					{product.subtitle && <p className='mb-1 mt-1 line-clamp-2 text-[0.7rem] font-medium leading-normal text-deep-tidal-teal-600 sm:text-[0.75rem]'>{product.subtitle}</p>}
				</div>

				<div className='mt-auto border-t border-deep-tidal-teal-800/15 pt-2.5 sm:pt-3'>
					<div className='flex flex-col items-start gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4'>
						<div className='space-y-0.5'>
							{saleDiscount > 0 && <p className='text-xs text-deep-tidal-teal-500 line-through sm:text-sm'>${getProductPrice(product)} CAD</p>}
							<p className={`text-sm xs:text-md font-medium leading-tight sm:text-[1.05rem] ${saleDiscount > 0 ? 'text-[#b42318]' : 'text-deep-tidal-teal-700'}`}>
								${getProductPrice(product, saleDiscount)} CAD
							</p>
						</div>
						{optionLabel && <p className='text-xs font-semibold text-deep-tidal-teal-700 underline underline-offset-2 sm:text-sm'></p>}
					</div>

					<button
						type='button'
						onClick={handleAdd}
						disabled={isSoldOut || justAdded}
						className='site-cta cta-secondary relative z-20 mt-3 min-h-10 w-full px-2 py-2 text-[11px] font-bold sm:mt-4 sm:min-h-12 sm:px-5 sm:py-3 sm:text-sm'>
						{justAdded ? <Check className='h-4 w-4' /> : isSoldOut ? <Loader2 className='h-4 w-4' /> : null}
						<span>{justAdded ? 'Added' : isSoldOut ? 'Unavailable' : 'Add To Cart'}</span>
					</button>
				</div>
			</div>
		</article>
	);
}
