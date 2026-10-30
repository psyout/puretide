'use client';

import { useState, useMemo } from 'react';
import type { Product, ProductVariant } from '@/types/product';
import { getSalePrice } from '@/lib/promo';
import { useCart } from '@/context/CartContext';
import ProductActions from '@/components/ProductActions';
import ProductTabs from '@/components/ProductTabs';
import { ChevronRight, CreditCard, FileBadge, Truck } from 'lucide-react';
import { iconMap } from '@/lib/productIcons';
import Link from 'next/link';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import { getDiscountedPrice } from '@/lib/pricing';

interface ProductDetailClientProps {
	product: Product;
	description: string;
	details?: string;
	hasCoaFile: boolean;
	matchingCoaFile?: string;
	stockUnavailable?: boolean;
}

export default function ProductDetailClient({ product, description, details, hasCoaFile, matchingCoaFile, stockUnavailable = false }: ProductDetailClientProps) {
	const { automaticPromotion } = useCart();
	const variants = useMemo(() => product.variants || [], [product.variants]);
	const hasVariants = variants.length > 1;

	// Default selection: first in-stock variant, else first variant
	const defaultVariant = useMemo(() => {
		const firstInStock = variants.find((v) => v.stock > 0);
		return firstInStock || variants[0] || null;
	}, [variants]);

	const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(defaultVariant);

	// If no variants, use the base product
	const currentVariant = selectedVariant;
	const displayPrice = currentVariant?.price ?? product.price;
	const saleDiscount = automaticPromotion?.discount ?? 0;
	const salePrice = getSalePrice(displayPrice, saleDiscount);
	const displayMg = currentVariant?.label ?? product.mg;
	const displayStock = currentVariant?.stock ?? product.stock;
	const isSoldOut = displayStock <= 0 || product.status === 'stock-out';
	const isPreOrder = product.slug === 'cartalax' || product.slug === 'dsip';

	// For variant products, check if all variants are sold out
	const allVariantsSoldOut = hasVariants && variants.every((v) => v.stock <= 0);

	const handleVariantChange = (variantKey: string) => {
		const variant = variants.find((v) => v.key === variantKey);
		if (variant) {
			setSelectedVariant(variant);
		}
	};

	// Build the product object to pass to ProductActions
	const productForActions = useMemo(() => {
		if (currentVariant) {
			return {
				...product,
				id: currentVariant.key,
				price: currentVariant.price,
				stock: currentVariant.stock,
				mg: currentVariant.label,
			};
		}
		return product;
	}, [product, currentVariant]);

	return (
		<>
			{/* Sold out badge */}
			{(isSoldOut || allVariantsSoldOut) && (
				<div className='mb-4'>
					<span className='text-xs font-semibold uppercase tracking-wide bg-deep-tidal-teal text-mineral-white px-2 py-1 rounded-md'>Sold out</span>
				</div>
			)}

			{/* Product name and mg */}
			<div className='mt-6'>
				<h1 className='text-3xl font-bold text-deep-tidal-teal-700 leading-tight'>
					{product.name}
					{displayMg && !product.name.toLowerCase().includes('stack') && (
						<span className='ml-2 inline-block align-top text-base text-deep-tidal-teal-600 font-bold whitespace-nowrap'>{displayMg}</span>
					)}
				</h1>
			</div>
			{product.subtitle && <p className='text-lg text-deep-tidal-teal-600 font-medium mb-4'>{product.subtitle}</p>}
			{!product.subtitle && <div className='mb-1' />}

			{/* Icons ***/}
			{product.icons && product.icons.length > 0 && (
				<>
					<div className='flex flex-wrap gap-2 mb-6 md:hidden'>
						{product.icons.map((iconName: string) => {
							const Icon = iconMap[iconName as keyof typeof iconMap];
							if (!Icon) return null;
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
					<div className='hidden md:flex flex-wrap gap-2 mb-6'>
						{product.icons.map((iconName: string) => {
							const Icon = iconMap[iconName as keyof typeof iconMap];
							if (!Icon) return null;
							return (
								<div
									key={iconName}
									className='inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-eucalyptus-100'>
									<Icon className='w-5 h-5 text-deep-tidal-teal-700' />
									<span className='text-xs font-medium text-deep-tidal-teal-700'>{iconName}</span>
								</div>
							);
						})}
					</div>
				</>
			)}

			{/* Price */}
			<div className='mb-4'>
				{saleDiscount > 0 && <div className='mt-8 inline-flex rounded-full bg-eucalyptus-100 px-3 py-1 text-sm font-bold text-deep-tidal-teal-800'>{saleDiscount}% OFF</div>}
				<div className={`${saleDiscount > 0 ? 'mt-2 flex items-baseline gap-3' : 'mt-8'} text-deep-tidal-teal-700`}>
					{saleDiscount > 0 && <span className='text-xl font-medium text-deep-tidal-teal-500 line-through'>C${displayPrice.toFixed(2)}</span>}
					<span className={`text-3xl font-bold ${saleDiscount > 0 ? 'text-[#b42318]' : ''}`}>
						<span className='text-[1.75rem] font-light'>C</span>${salePrice.toFixed(2)}
					</span>
				</div>
				<div className='flex flex-col items-start gap-1.5 text-xs text-deep-tidal-teal-600 min-[401px]:flex-row min-[401px]:items-center min-[401px]:gap-3 md:text-sm'>
					<span className='flex items-center gap-1'>
						<CreditCard className='w-4 h-4' />
						5% fee when paying by card
					</span>
					<span className='hidden text-deep-tidal-teal-300 min-[401px]:inline'>•</span>
					<span className='flex items-center gap-1 text-emerald-600'>
						<Truck className='w-4 h-4' />
						{`Free shipping over $${FREE_SHIPPING_THRESHOLD}`}
					</span>
				</div>
			</div>

			{/* Size Selector - only show when variants exist */}
			{hasVariants && (
				<fieldset className='mb-6'>
					<div className='flex items-center gap-3'>
						<legend className='text-sm font-semibold text-deep-tidal-teal-700 mb-0'>Size:</legend>
						<div
							className='inline-flex rounded-xl bg-white shadow-sm ui-border overflow-hidden'
							role='radiogroup'
							aria-label='Size'>
							{variants.map((variant) => {
								const isSelected = selectedVariant?.key === variant.key;
								const isVariantSoldOut = variant.stock <= 0;
								return (
									<label
										key={variant.key}
										className={`relative cursor-pointer select-none px-4 py-2.5 text-sm font-semibold transition-colors focus-within:outline-none ${
											isSelected ? 'bg-deep-tidal-teal-700 text-mineral-white' : 'bg-white text-deep-tidal-teal-700 hover:bg-deep-tidal-teal/5'
										} ${isVariantSoldOut ? 'opacity-50 cursor-not-allowed' : ''} ${variant !== variants[0] ? 'border-l ui-border' : ''}`}
										aria-label={variant.label}>
										<input
											type='radio'
											name='size'
											value={variant.key}
											checked={isSelected}
											onChange={() => !isVariantSoldOut && handleVariantChange(variant.key)}
											disabled={isVariantSoldOut}
											className='sr-only'
										/>
										{variant.label}
										{isVariantSoldOut && <span className='ml-1 text-xs'>(Sold Out)</span>}
									</label>
								);
							})}
						</div>
					</div>
				</fieldset>
			)}

			{/* Stock status and purchase actions */}
			{!isPreOrder && !stockUnavailable && !isSoldOut && !allVariantsSoldOut && (
				<p className={`mb-4 flex items-center gap-2 text-sm font-semibold ${displayStock <= 3 ? 'text-amber-700' : 'text-emerald-700'}`}>
					<span className={`h-2 w-2 rounded-full ${displayStock <= 3 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
					{displayStock <= 3 ? `Only ${displayStock} remaining` : 'In stock and ready to ship'}
				</p>
			)}
			{isPreOrder && (
				<p className='mb-4 flex items-center gap-2 text-sm font-semibold text-amber-600'>
					<span className='h-2 w-2 rounded-full bg-amber-500' />
					<span>
						<strong>Pre-Order:</strong> This product ships in approximately 1 week
					</span>
				</p>
			)}

			{stockUnavailable && (
				<div className='bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6'>
					<p
						className='text-sm text-amber-800'
						role='alert'>
						<strong>Inventory System Offline:</strong> Real-time stock data is temporarily unavailable. Please try again later or contact us for availability before placing an order.
					</p>
				</div>
			)}

			<div className='mb-6'>
				<ProductActions product={productForActions} />
			</div>

			{/* COA */}
			{hasCoaFile && (
				<div className='mb-5'>
					<Link
						href={`/coa/${matchingCoaFile}`}
						target='_blank'
						rel='noopener noreferrer'
						className='group flex w-full items-center gap-3 rounded-xl border border-deep-tidal-teal/15 bg-white px-4 py-3 text-deep-tidal-teal-800 shadow-sm transition-all duration-200 hover:border-deep-tidal-teal/35 hover:shadow-md'>
						<span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-eucalyptus-100 text-deep-tidal-teal-700'>
							<FileBadge className='h-5 w-5 stroke-[1.5]' />
						</span>
						<span className='min-w-0 flex-1'>
							<span className='block text-sm font-bold leading-tight'>View lab certificate</span>
							<span className='mt-0.5 block text-xs font-medium text-deep-tidal-teal-600'>Certificate of Analysis (COA)</span>
						</span>
						<ChevronRight className='h-5 w-5 shrink-0' />
					</Link>
				</div>
			)}

			{/* Quantity pricing */}
			{product.slug !== 'bacteriostatic-water' && saleDiscount === 0 && (
				<section
					className='mb-6 mt-8 overflow-hidden rounded-xl border border-deep-tidal-teal/15 bg-mineral-white'
					aria-label='Quantity pricing'>
					<table className='w-full border-collapse text-sm'>
						<thead className='sr-only'>
							<tr>
								<th>Quantity</th>
								<th>Unit price</th>
							</tr>
						</thead>
						<tbody className='divide-y divide-deep-tidal-teal/10'>
							<tr>
								<td className='px-5 py-4 text-[0.9rem] font-medium text-deep-tidal-teal-700'>1–2 units</td>
								<td className='px-5 py-4 text-right text-[0.9rem] font-medium text-deep-tidal-teal-700'>C${displayPrice.toFixed(2)} each</td>
							</tr>
							<tr>
								<td className='px-5 py-4 text-[0.9rem] font-medium text-deep-tidal-teal-700'>3–4 units</td>
								<td className='px-5 py-4 text-right text-[0.9rem] font-semibold text-emerald-700'>C${getDiscountedPrice(displayPrice, 3).toFixed(2)} each</td>
							</tr>
							<tr>
								<td className='px-5 py-4 text-[0.9rem] font-medium text-deep-tidal-teal-700'>5+ units</td>
								<td className='px-5 py-4 text-right text-[0.9rem] font-semibold text-emerald-700'>C${getDiscountedPrice(displayPrice, 5).toFixed(2)} each</td>
							</tr>
						</tbody>
					</table>
				</section>
			)}

			{/* Supporting product information */}
			<div className='mb-6'>
				<ProductTabs
					productSlug={product.slug}
					description={description}
					details={details}
				/>
			</div>
		</>
	);
}
