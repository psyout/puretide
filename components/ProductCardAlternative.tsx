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
	const allVariantsSoldOut = hasVariants && variants.every((variant) => variant.stock <= 0);
	const isSoldOut = allVariantsSoldOut || (!hasVariants && (Number(product.stock) <= 0 || product.status === 'stock-out'));
	const isLowStock = !isSoldOut && !hasVariants && Number(product.stock) < 10;
	const defaultVariant = hasVariants ? (variants.find((variant) => variant.stock > 0) ?? variants[0]) : null;
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
			className='group relative isolate flex h-full flex-col bg-mineral-white'>
			<Link
				href={`/product/${product.slug}`}
				aria-label={`View ${product.name}`}
				className='absolute inset-0 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-tidal-teal focus-visible:ring-offset-2'
			/>

			<div className='relative flex aspect-square items-center justify-center overflow-hidden bg-[#f3f4f4]'>
				{saleDiscount > 0 && (
					<span className='absolute right-4 top-4 z-20 rounded-full bg-deep-tidal-teal px-3 py-1.5 text-xs font-bold text-white'>{saleDiscount}% OFF</span>
				)}
				{primaryIconName && PrimaryIcon && (
					<span className='absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-eucalyptus-100 px-3 py-1.5 text-xs font-medium text-deep-tidal-teal-700'>
						<PrimaryIcon className='h-4 w-4 text-deep-tidal-teal-700' />
						{primaryIconName}
					</span>
				)}
				{(isLowStock || isSoldOut) && (
					<span
						className={`absolute bottom-4 left-4 z-20 inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold shadow-sm backdrop-blur-sm ${
							isSoldOut ? 'bg-deep-tidal-teal-800/95 text-white' : 'bg-white/90 text-amber-700'
						}`}>
						<CircleAlert
							className='h-4 w-4'
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
					<div className='relative h-[64%] w-[64%] transition-transform duration-500 ease-out group-hover:scale-[1.025]'>
						<Image
							src={product.image}
							alt={product.name}
							fill
							sizes='(max-width: 640px) 64vw, (max-width: 1024px) 32vw, 16vw'
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

			<div className='flex min-h-[13rem] min-w-0 flex-1 flex-col px-5 pb-5 pt-4 sm:px-6 sm:pb-6'>
				<div className='min-w-0'>
					<h3 className='text-[1rem] font-medium leading-tight text-deep-tidal-teal-700 transition-colors group-hover:text-deep-tidal-teal'>{product.name}</h3>
					{product.subtitle && <p className='mt-1 mb-1 line-clamp-2 text-[0.7rem] font-medium leading-normal text-deep-tidal-teal-600'>{product.subtitle}</p>}
				</div>

				<div className='mt-auto border-t border-deep-tidal-teal-800/15 pt-3'>
					<div className='flex items-end justify-between gap-4'>
						<div className='space-y-0.5'>
							{saleDiscount > 0 && (
								<p className='text-sm text-deep-tidal-teal-500 line-through'>${getProductPrice(product)} CAD</p>
							)}
							<p className={`text-lg font-bold ${saleDiscount > 0 ? 'text-[#b42318]' : 'text-deep-tidal-teal-700'}`}>${getProductPrice(product, saleDiscount)} CAD</p>
						</div>
						{optionLabel && <p className='text-sm font-semibold text-deep-tidal-teal-700 underline underline-offset-2'>{optionLabel}</p>}
					</div>

					<button
						type='button'
						onClick={handleAdd}
						disabled={isSoldOut || justAdded}
						className='relative z-20 mt-4  inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-deep-tidal-teal-700/20 bg-transparent px-4 py-3 text-base font-bold text-deep-tidal-teal-700 transition hover:border-deep-tidal-teal hover:bg-deep-tidal-teal hover:text-white disabled:cursor-not-allowed disabled:border-deep-tidal-teal-800/10 disabled:text-deep-tidal-teal-400'>
						{justAdded ? <Check className='h-4 w-4' /> : isSoldOut ? <Loader2 className='h-4 w-4' /> : null}
						<span>{justAdded ? 'Added' : isSoldOut ? 'Unavailable' : 'Add To Cart'}</span>
					</button>
				</div>
			</div>
		</article>
	);
}
