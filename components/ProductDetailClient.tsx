'use client';

import { useEffect, useState, useMemo } from 'react';
import type { Product, ProductVariant } from '@/types/product';
import ProductActions from '@/components/ProductActions';
import ProductTabs from '@/components/ProductTabs';
import { ChevronRight, CreditCard, FileBadge, FlaskConical, Truck } from 'lucide-react';
import { iconMap } from '@/lib/productIcons';
import Link from 'next/link';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import { GA_CURRENCY, toAnalyticsItem, trackEvent } from '@/lib/analytics';

interface ProductDetailClientProps {
	product: Product;
	description: string;
	details?: string;
	hasCoaFile: boolean;
	matchingCoaFile?: string;
	stockUnavailable?: boolean;
}

export default function ProductDetailClient({ product, description, details, hasCoaFile, matchingCoaFile, stockUnavailable = false }: ProductDetailClientProps) {
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
	const displayMg = currentVariant?.label ?? product.mg;
	const displayStock = currentVariant?.stock ?? product.stock;
	const isSoldOut = displayStock <= 0 || product.status === 'stock-out';

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

	useEffect(() => {
		const item = toAnalyticsItem(productForActions);
		trackEvent('view_item', { currency: GA_CURRENCY, value: item.price, items: [item] });
	}, [productForActions]);

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
				<div className='text-3xl font-bold text-deep-tidal-teal-700 mt-8'>
					<span className='text-deep-tidal-teal-700 text-[1.75rem] font-light'>C</span>${displayPrice.toFixed(2)}
				</div>
				<div className='flex flex-row xs:flex-col items-start gap-3 text-xs md:text-sm text-deep-tidal-teal-600 sm:flex-row sm:items-center sm:gap-3'>
					<span className='flex items-center gap-1'>
						<CreditCard className='w-4 h-4' />
						5% fee when paying by card
					</span>
					<span className='hidden text-deep-tidal-teal-300 sm:inline'>•</span>
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
			{!stockUnavailable && !isSoldOut && !allVariantsSoldOut && (
				<p className={`mb-4 flex items-center gap-2 text-sm font-semibold ${displayStock <= 3 ? 'text-amber-700' : 'text-emerald-700'}`}>
					<span className={`h-2 w-2 rounded-full ${displayStock <= 3 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
					{displayStock <= 3 ? `Only ${displayStock} remaining` : 'In stock and ready to ship'}
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

			{/* Discount Table */}
			{product.slug !== 'bacteriostatic-water' && (
				<div className='mb-6 mt-10 max-w overflow-hidden rounded-lg border-deep-tidal-teal/10 bg-mineral-white shadow-sm hidden'>
					<div className='bg-deep-tidal-teal/5 px-3 py-2 border-b border-deep-tidal-teal/10'>
						<h3 className='text-sm font-bold text-deep-tidal-teal-700 tracking-wider'>Discount per quantity</h3>
					</div>
					<div className='overflow-x-auto'>
						<table className='w-full text-[14px] text-left'>
							<thead>
								<tr className='border-b border-deep-tidal-teal/5'>
									<th className='px-4 py-2 font-semibold text-deep-tidal-teal-700'>Quantity</th>
									<th className='px-4 py-2 font-medium text-deep-tidal-teal-600'>2 - 5</th>
									<th className='px-4 py-2 font-medium text-deep-tidal-teal-600'>6 - 7</th>
									<th className='px-4 py-2 font-medium text-deep-tidal-teal-600'>8 - 9</th>
									<th className='px-4 py-2 font-medium text-deep-tidal-teal-600'>10 +</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td className='px-4 py-3 font-semibold text-deep-tidal-teal-700'>Discount</td>
									<td className='px-4 py-3 text-emerald-600 font-bold'>5%</td>
									<td className='px-4 py-3 text-emerald-600 font-bold'>10%</td>
									<td className='px-4 py-3 text-emerald-600 font-bold'>15%</td>
									<td className='px-4 py-3 text-emerald-600 font-bold'>25%</td>
								</tr>
								<tr className='border-t border-deep-tidal-teal/5'>
									<td className='px-4 py-3 font-semibold text-deep-tidal-teal-700'>Price</td>
									<td className='px-4 py-3 text-deep-tidal-teal-700 font-medium'>${(displayPrice * 0.95).toFixed(2)}</td>
									<td className='px-4 py-3 text-deep-tidal-teal-700 font-medium'>${(displayPrice * 0.9).toFixed(2)}</td>
									<td className='px-4 py-3 text-deep-tidal-teal-700 font-medium'>${(displayPrice * 0.85).toFixed(2)}</td>
									<td className='px-4 py-3 text-deep-tidal-teal-700 font-medium'>${(displayPrice * 0.75).toFixed(2)}</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Supporting product information */}
			<div className='mb-6'>
				<ProductTabs
					productSlug={product.slug}
					description={description}
					details={details}
				/>
			</div>

			<div className='mb-10 pl-3 border-l-4 border-deep-tidal-teal-500 tracking-wide'>
				<h2 className='text-lg font-bold tracking-tight'>Important: Research Use Only</h2>
				<p className='text-sm text-deep-tidal-teal-700 mt-2'>
					All compounds sold by Pure Tide are intended exclusively for laboratory and bench-research applications and are not for human or veterinary use. Nothing on this website should
					be interpreted as medical, dietary, diagnostic, or therapeutic advice. Unless otherwise stated, Pure Tide products may be an investigational compounds and have not received
					regulatory approval from Health Canada, the U.S. FDA, the EMA, or any equivalent body at this writing. Research information is provided solely for scientific and educational
					reference. Pure Tide does not provide dosing, administration, or application instructions. Purchasers are responsible for compliance with all applicable laws, regulations, and
					laboratory safety standards.
				</p>
			</div>

			{/* Research and delivery notice */}
			<div className='mb-8 md:mb-10'>
				<p className='mb-2 text-xs font-bold uppercase tracking-wider text-deep-tidal-teal-600'>Important information</p>
				<div className='grid grid-cols-1 divide-y divide-deep-tidal-teal/15 rounded-2xl bg-gradient-to-br from-deep-tidal-teal/5 to-eucalyptus-50/80 p-4 xl:grid-cols-2 xl:divide-x xl:divide-y-0 xl:divide-deep-tidal-teal/20 xl:p-5'>
					<div className='flex items-center gap-3 pb-4 xl:pr-6 xl:pb-0'>
						<span className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-eucalyptus-100 text-deep-tidal-teal-700 shadow-sm'>
							<FlaskConical className='h-6 w-6' />
						</span>
						<p className='text-sm leading-relaxed text-deep-tidal-teal-800'>
							<strong className='font-bold text-md'>For research use only.</strong> Not intended for human or animal consumption.
						</p>
					</div>
					<div className='flex items-center gap-3 pt-4 xl:pl-6 xl:pt-0'>
						<span className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-eucalyptus-100 text-deep-tidal-teal-700 shadow-sm'>
							<Truck className='h-6 w-6' />
						</span>
						<p className='text-sm leading-relaxed text-deep-tidal-teal-800'>
							<strong className='font-bold text-md'>Not responsible for shipments</strong> to incorrect addresses. Please double check before placing your order.
						</p>
					</div>
				</div>
			</div>
		</>
	);
}
