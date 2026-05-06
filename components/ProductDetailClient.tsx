'use client';

import { useState, useMemo } from 'react';
import type { Product, ProductVariant } from '@/types/product';
import ProductActions from '@/components/ProductActions';
import ProductTabs from '@/components/ProductTabs';
import { CreditCard, Truck, FlaskConical, FileText } from 'lucide-react';
import { iconMap } from '@/lib/productIcons';
import Link from 'next/link';

interface ProductDetailClientProps {
	product: Product;
	description: string;
	details?: string;
	hasCoaFile: boolean;
	matchingCoaFile?: string;
}

export default function ProductDetailClient({ product, description, details, hasCoaFile, matchingCoaFile }: ProductDetailClientProps) {
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
				<h1 className='text-4xl font-bold text-deep-tidal-teal-700 leading-tight'>
					{product.name}
					{displayMg && !product.name.toLowerCase().includes('stack') && (
						<span className='ml-2 inline-block align-top text-base text-deep-tidal-teal-600 font-bold whitespace-nowrap'>{displayMg}mg</span>
					)}
				</h1>
			</div>
			{product.subtitle && <p className='text-lg text-deep-tidal-teal-600 font-medium mb-4'>{product.subtitle}</p>}
			{!product.subtitle && <div className='mb-1' />}

			{/* Icons */}
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
									<Icon className='w-5 h-5 text-deep-tidal-teal-700' />
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
				<div className='text-4xl font-bold text-deep-tidal-teal-700 mt-8'>
					<span className='text-deep-tidal-teal-700 text-[2rem] font-light'>C</span>${displayPrice.toFixed(2)}
				</div>
				<div className='flex items-center gap-3 text-sm text-deep-tidal-teal-600'>
					<span className='flex items-center gap-1'>
						<CreditCard className='w-4 h-4' />
						+5% card fee
					</span>
					<span className='text-deep-tidal-teal-300'>•</span>
					<span className='flex items-center gap-1 text-emerald-600'>
						<Truck className='w-4 h-4' />
						Free shipping over $400
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

			{/* Details & Description (accordion) */}
			<div className='mb-6'>
				<ProductTabs
					description={description}
					details={details}
				/>
			</div>

			{/* Discount Table */}
			{product.slug !== 'bacteriostatic-water' && (
				<div className='mb-6 mt-10 max-w overflow-hidden rounded-lg border-deep-tidal-teal/10 bg-mineral-white shadow-sm'>
					<div className='bg-deep-tidal-teal/5 px-4 py-2 border-b border-deep-tidal-teal/10'>
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

			{/* COA */}
			{hasCoaFile && (
				<div className='mb-6'>
					<div className='flex overflow-x-auto pb-2 -mx-6 px-6 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible gap-0.5'>
						<FileText className='w-5 h-5 text-deep-tidal-teal-700' />
						<div className='flex-shrink-0 inline-flex items-center'>
							<Link
								href={`/coa/${matchingCoaFile}`}
								target='_blank'
								rel='noopener noreferrer'
								className='text-deep-tidal-teal-700 text-sm transition-colors duration-200 relative group hover:text-deep-tidal-teal-800 z-10 pl-0.5 pr-1'>
								<span className='relative z-10 text-deep-tidal-teal-700 group-hover:text-deep-tidal-teal-800'>View COA</span>
								<span className='absolute bottom-0 left-0 h-0.5 bg-deep-tidal-teal-700 transition-all duration-300 w-full md:w-0 md:group-hover:w-full md:origin-left'></span>
							</Link>
						</div>
					</div>
				</div>
			)}

			{/* Disclaimers */}
			<div className='flex flex-col mb-6'>
				<div className='flex items-center gap-2'>
					<FlaskConical className='w-4 h-4 text-deep-tidal-teal-500 mt-0.5 flex-shrink-0' />
					<p className='md:text-[13px] text-xs text-deep-tidal-teal-600'>For research use only. Not intended for human or animal consumption.</p>
				</div>
				<div className='flex items-center gap-2 mt-2'>
					<Truck className='w-4 h-4 text-deep-tidal-teal-500 mt-0.5 flex-shrink-0' />
					<p className='md:text-[13px] text-xs text-deep-tidal-teal-600'>Not responsible for shipments to incorrect addresses. Please double check.</p>
				</div>
			</div>

			{/* Actions */}
			<ProductActions product={productForActions} />
		</>
	);
}
