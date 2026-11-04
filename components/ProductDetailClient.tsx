'use client';

import { useState, useMemo } from 'react';
import type { Product, ProductVariant } from '@/types/product';
import { getSalePrice } from '@/lib/promo';
import { useCart } from '@/context/CartContext';
import ProductActions from '@/components/ProductActions';
import { ChevronDown, CreditCard, FlaskConical, ShieldCheck, Truck } from 'lucide-react';
import { iconMap } from '@/lib/productIcons';
import Link from 'next/link';
import Image from 'next/image';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import { getDiscountedPrice } from '@/lib/pricing';
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';
import { parseProductDescription } from '@/lib/productDescription';

interface ProductDetailClientProps {
	product: Product;
	description: string;
	details?: string;
	hasCoaFile: boolean;
	matchingCoaFile?: string;
	stockUnavailable?: boolean;
	relatedProducts?: Product[];
}

const RESEARCH_USE_NOTICE =
	'All compounds sold by Pure Tide are intended exclusively for laboratory and bench-research applications and are not for human or veterinary use. Nothing on this website should be interpreted as medical, dietary, diagnostic, or therapeutic advice. Unless otherwise stated, Pure Tide products may be investigational compounds and have not received regulatory approval from Health Canada, the U.S. FDA, the EMA, or any equivalent body at this writing. Research information is provided solely for scientific and educational reference. Pure Tide does not provide dosing, administration, or application instructions. Purchasers are responsible for compliance with all applicable laws, regulations, and laboratory safety standards.';

function getProductFormat(product: Product): string {
	const productText = `${product.name} ${product.subtitle ?? ''}`.toLocaleLowerCase();
	if (productText.includes('tablet')) return 'Tablets';
	if (product.slug === 'bacteriostatic-water') return 'Sterile solution';
	if (product.category.toLocaleLowerCase() === 'accessory') return 'Accessory';
	return 'Lyophilized powder';
}

export default function ProductDetailClient({ product, description, details, hasCoaFile, matchingCoaFile, stockUnavailable = false, relatedProducts = [] }: ProductDetailClientProps) {
	const { automaticPromotion } = useCart();
	const variants = useMemo(() => product.variants || [], [product.variants]);
	const hasVariants = variants.length > 1;

	// Default selection: first in-stock variant, else first variant
	const defaultVariant = useMemo(() => {
		const firstInStock = variants.find((v) => v.stock > 0);
		return firstInStock || variants[0] || null;
	}, [variants]);

	const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(defaultVariant);
	const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

	// If no variants, use the base product
	const currentVariant = selectedVariant;
	const displayPrice = currentVariant?.price ?? product.price;
	const saleDiscount = automaticPromotion?.discount ?? 0;
	const salePrice = getSalePrice(displayPrice, saleDiscount);
	const displayMg = currentVariant?.label ?? product.mg;
	const displayStock = currentVariant?.stock ?? product.stock;
	const isSoldOut = displayStock <= 0 || product.status === 'stock-out';
	const isPreOrder = product.slug === 'cartalax' || product.slug === 'dsip';
	const normalizedName = product.name.toLocaleLowerCase();
	const normalizedStrength = displayMg?.trim().toLocaleLowerCase();
	const showStrength = Boolean(normalizedStrength) && !normalizedName.includes('stack') && !normalizedName.includes(normalizedStrength!);
	const displayName = showStrength ? `${product.name} – ${displayMg}` : product.name;
	const strengthFromName = !normalizedName.includes('stack') ? product.name.match(/\b\d+(?:\.\d+)?\s*(?:mcg|mg|g|ml)\b/i)?.[0] : undefined;
	const displayStrength = displayMg || strengthFromName;
	const productFormat = getProductFormat(product);
	const { copy: descriptionCopy, ctas: descriptionCtas } = parseProductDescription(description, product.slug);
	const showQuantityPricing = product.slug !== 'bacteriostatic-water' && saleDiscount === 0;

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
		<div className='contents'>
			<div className='min-w-0 md:col-start-2 md:row-start-1 md:w-full'>
				{/* Sold out badge */}
				{(isSoldOut || allVariantsSoldOut) && (
					<div className='mb-4'>
						<span className='text-xs font-semibold uppercase tracking-wide bg-deep-tidal-teal text-mineral-white px-2 py-1 rounded-md'>Sold out</span>
					</div>
				)}

				{/* Product name and mg */}
				<div className='mt-1 md:mt-0'>
					<h1 className='text-3xl font-bold text-deep-tidal-teal-700 leading-tight'>{displayName}</h1>
				</div>
				{product.subtitle && <p className='text-lg text-deep-tidal-teal-600 font-medium mb-4'>{product.subtitle}</p>}
				{!product.subtitle && <div className='mb-1' />}

				{/* Icons ***/}
				{product.icons && product.icons.length > 0 && (
					<div className='mb-6 flex flex-wrap gap-2'>
						{product.icons.map((iconName: string) => {
							const Icon = iconMap[iconName as keyof typeof iconMap];
							if (!Icon) return null;
							return (
								<div
									key={iconName}
									className='inline-flex items-center gap-1.5 rounded-full bg-eucalyptus-100 px-3 py-1.5 text-deep-tidal-teal-700'>
									<Icon
										className='h-4 w-4'
										aria-hidden='true'
									/>
									<span className='text-xs font-medium'>{iconName}</span>
								</div>
							);
						})}
					</div>
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
					<div className='mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-deep-tidal-teal-600 md:text-sm'>
						<span className='flex items-center gap-1.5'>
							<CreditCard
								className='h-4 w-4 shrink-0'
								aria-hidden='true'
							/>
							5% fee when paying by card
						</span>
						<span
							aria-hidden='true'
							className='hidden h-4 w-px bg-deep-tidal-teal/20 min-[390px]:block'
						/>
						<span className='flex items-center gap-1.5 text-emerald-700'>
							<Truck
								className='h-4 w-4 shrink-0'
								aria-hidden='true'
							/>
							{`Free shipping over $${FREE_SHIPPING_THRESHOLD}`}
						</span>
					</div>
				</div>

				{(descriptionCopy || descriptionCtas.length > 0) && (
					<div className='mb-5 border-b border-deep-tidal-teal/15 pb-5 text-[0.95rem] text-pretty leading-6 text-deep-tidal-teal-700'>
						{descriptionCopy && <p>{descriptionCopy}</p>}
						{descriptionCtas.map((cta) => (
							<p
								key={cta.href}
								className='mt-2'>
								Also available in{' '}
								<Link
									href={cta.href}
									className='font-semibold underline decoration-deep-tidal-teal/40 underline-offset-4 hover:text-deep-tidal-teal-900'>
									{cta.label}
								</Link>
							</p>
						))}
					</div>
				)}

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
											className={`relative cursor-pointer select-none px-4 py-2.5 text-sm font-semibold transition-colors focus-within:z-10 focus-within:outline-none focus-within:ring-2 focus-within:ring-inset focus-within:ring-deep-tidal-teal/40 ${
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
												className='peer sr-only'
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
							<strong>Inventory System Offline:</strong> Real-time stock data is temporarily unavailable. Please try again later or contact us for availability before placing an
							order.
						</p>
					</div>
				)}

				<div className='mb-6'>
					<ProductActions product={productForActions} />
				</div>

				{/* COA */}
				{hasCoaFile && (
					<div className='mb-5 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-deep-tidal-teal-700'>
						<span className='inline-flex items-center gap-2 font-semibold'>
							<FlaskConical
								className='h-5 w-5 shrink-0'
								aria-hidden='true'
							/>
							Independently lab tested
						</span>
						<span
							aria-hidden='true'
							className='hidden h-4 w-px bg-deep-tidal-teal/20 min-[350px]:block'
						/>
						<Link
							href={`/coa/${matchingCoaFile}`}
							target='_blank'
							rel='noopener noreferrer'
							aria-label='View lab report (opens in a new tab)'
							className='inline-flex min-h-11 items-center rounded-sm font-semibold underline decoration-1 underline-offset-4 hover:text-deep-tidal-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep-tidal-teal/40 focus-visible:ring-offset-2'>
							View lab report
						</Link>
					</div>
				)}
			</div>

			<section
				aria-label='Store assurances'
				className='order-2 col-span-full grid grid-cols-3 divide-x divide-deep-tidal-teal/15 mb-10 border-deep-tidal-teal/15'>
				<div className='flex min-w-0 flex-col items-center justify-center gap-2 px-1 py-5 text-center sm:px-3'>
					<Truck
						className='h-6 w-6 shrink-0 text-deep-tidal-teal-700'
						aria-hidden='true'
					/>
					<span className='text-[0.7rem] font-semibold leading-tight text-deep-tidal-teal-800 sm:text-sm'>Fast shipping</span>
				</div>
				<div className='flex min-w-0 flex-col items-center justify-center gap-2 px-1 py-5 text-center sm:px-3'>
					<ShieldCheck
						className='h-6 w-6 shrink-0 text-deep-tidal-teal-700'
						aria-hidden='true'
					/>
					<span className='text-[0.7rem] font-semibold leading-tight text-deep-tidal-teal-800 sm:text-sm'>Quality assured</span>
				</div>
				<div className='flex min-w-0 flex-col items-center justify-center gap-2 px-1 py-5 text-center sm:px-3'>
					<CreditCard
						className='h-6 w-6 shrink-0 text-deep-tidal-teal-700'
						aria-hidden='true'
					/>
					<span className='text-[0.7rem] font-semibold leading-tight text-deep-tidal-teal-800 sm:text-sm'>Secure checkout</span>
				</div>
			</section>

			<section
				className='product-information-tabs order-1 col-span-full min-w-0 my-10'
				aria-label='Product information'>
				<input
					className='sr-only'
					type='radio'
					name='product-information-tabs'
					id='research-details-tab'
					defaultChecked
				/>
				<input
					className='sr-only'
					type='radio'
					name='product-information-tabs'
					id='research-use-tab'
				/>
				{showQuantityPricing && (
					<input
						className='sr-only'
						type='radio'
						name='product-information-tabs'
						id='quantity-pricing-tab'
					/>
				)}
				<input
					className='sr-only'
					type='radio'
					name='product-information-tabs'
					id='usage-details-tab'
				/>
				<input
					className='sr-only'
					type='radio'
					name='product-information-tabs'
					id='shipping-information-tab'
				/>

				<div className='product-information-tab-scroll'>
					<div className={`product-information-tab-list grid ${showQuantityPricing ? 'grid-cols-5' : 'grid-cols-4'}`}>
						<label
							htmlFor='research-details-tab'
							className='product-information-tab'>
							Research details
						</label>
						<label
							htmlFor='research-use-tab'
							className='product-information-tab'>
							Research use only
						</label>
						{showQuantityPricing && (
							<label
								htmlFor='quantity-pricing-tab'
								className='product-information-tab'>
								Quantity pricing
							</label>
						)}
						<label
							htmlFor='usage-details-tab'
							className='product-information-tab'>
							Usage &amp; details
						</label>
						<label
							htmlFor='shipping-information-tab'
							className='product-information-tab'>
							Shipping
						</label>
					</div>
				</div>

				<div className='product-information-tab-panels'>
					<section
						className='product-information-panel research-details-panel'
						aria-label='Research details'>
						<p className='text-[1rem] leading-7 text-deep-tidal-teal-700'>{details || 'Additional research details are not currently available for this product.'}</p>
					</section>
					<section
						className='product-information-panel research-use-panel'
						aria-label='Important research use information'>
						<p className='text-[1rem] leading-7 text-deep-tidal-teal-700'>{RESEARCH_USE_NOTICE}</p>
					</section>
					{showQuantityPricing && (
						<section
							className='product-information-panel quantity-pricing-panel'
							aria-label='Quantity pricing'>
							<table className='w-full border-collapse text-md'>
								<thead className='sr-only'>
									<tr>
										<th>Quantity</th>
										<th>Unit price</th>
									</tr>
								</thead>
								<tbody className='divide-y divide-deep-tidal-teal/10'>
									<tr>
										<td className='py-3 pr-5 font-medium text-deep-tidal-teal-700'>1–2 units</td>
										<td className='py-3 text-right font-medium text-deep-tidal-teal-700'>C${displayPrice.toFixed(2)} each</td>
									</tr>
									<tr>
										<td className='py-3 pr-5 font-medium text-deep-tidal-teal-700'>3–4 units</td>
										<td className='py-3 text-right font-semibold text-emerald-700'>C${getDiscountedPrice(displayPrice, 3).toFixed(2)} each</td>
									</tr>
									<tr>
										<td className='py-3 pr-5 font-medium text-deep-tidal-teal-700'>5+ units</td>
										<td className='py-3 text-right font-semibold text-emerald-700'>C${getDiscountedPrice(displayPrice, 5).toFixed(2)} each</td>
									</tr>
								</tbody>
							</table>
						</section>
					)}
					<section
						className='product-information-panel usage-details-panel'
						aria-label='Usage and product details'>
						<ul className='list-disc space-y-2 pl-5 text-[1rem] leading-7 text-deep-tidal-teal-700'>
							<li>
								<strong>Format:</strong> {productFormat}
							</li>
							{displayStrength && (
								<li>
									<strong>Strength:</strong> {displayStrength}
								</li>
							)}
							{product.purity && (
								<li>
									<strong>Purity:</strong> {product.purity}
								</li>
							)}
						</ul>
					</section>
					<section
						className='product-information-panel shipping-information-panel'
						aria-label='Shipping information'>
						<ul className='list-disc space-y-2 pl-5 text-[1rem] leading-7 text-deep-tidal-teal-700'>
							<li>Ships from our warehouse</li>
							<li>
								<strong>Processing:</strong> 1–2 business days
							</li>
							<li>Free shipping over ${FREE_SHIPPING_THRESHOLD}</li>
						</ul>
					</section>
				</div>
			</section>

			<section
				className='hidden order-4 col-span-full border-t border-deep-tidal-teal/15 pt-6'
				aria-labelledby='product-faq-heading'>
				<h2
					id='product-faq-heading'
					className='mb-4 text-2xl font-bold text-deep-tidal-teal-900'>
					FAQ
				</h2>
				<div className='space-y-2'>
					{[
						{ question: 'How is it shipped?', answer: 'Orders are packed carefully and typically processed within 1–2 business days before shipment.' },
						{ question: 'What is the purity?', answer: 'Available purity information is shown in the product details and supporting lab report for this item.' },
						{ question: 'Do you offer returns?', answer: 'Please contact our support team with your order details so we can review the available options.' },
					].map((item, index) => {
						const isOpen = openFaqIndex === index;
						return (
							<div
								key={item.question}
								className='overflow-hidden rounded-lg border border-deep-tidal-teal/20 bg-white'>
								<button
									type='button'
									onClick={() => setOpenFaqIndex(isOpen ? null : index)}
									aria-expanded={isOpen}
									aria-controls={`product-faq-${index}`}
									className='flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2.5 text-left font-semibold text-deep-tidal-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-deep-tidal-teal/40'>
									<span>{item.question}</span>
									<ChevronDown
										className={`h-5 w-5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
										aria-hidden='true'
									/>
								</button>
								{isOpen && (
									<p
										id={`product-faq-${index}`}
										className='border-t border-deep-tidal-teal/10 px-4 py-3 text-sm leading-6 text-deep-tidal-teal-700'>
										{item.answer}
									</p>
								)}
							</div>
						);
					})}
				</div>
			</section>

			{relatedProducts.length > 0 && (
				<section
					className='order-5 col-span-full border-t border-deep-tidal-teal/15 pt-6'
					aria-labelledby='related-products-heading'>
					<h2
						id='related-products-heading'
						className='mb-4 text-2xl font-semibold text-deep-tidal-teal-900'>
						Related products
					</h2>
					<div className='grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4'>
						{relatedProducts.map((relatedProduct) => {
							const relatedVariants = relatedProduct.variants ?? [];
							const relatedBasePrice = relatedVariants.length > 1 ? Math.min(...relatedVariants.map((variant) => variant.price)) : relatedProduct.price;
							const relatedPrice = getSalePrice(relatedBasePrice, saleDiscount);
							return (
								<Link
									key={relatedProduct.id}
									href={`/product/${relatedProduct.slug}`}
									className='group overflow-hidden rounded-xl border border-deep-tidal-teal/15 bg-white transition-colors hover:border-deep-tidal-teal/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep-tidal-teal/40'>
									<div className='relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-eucalyptus-50 via-mineral-white to-deep-tidal-teal/5 p-4'>
										{hasProductImage(relatedProduct.image) ? (
											<Image
												src={relatedProduct.image}
												alt={relatedProduct.name}
												fill
												sizes='(max-width: 768px) 45vw, 220px'
												unoptimized={relatedProduct.image.startsWith('http')}
												className='object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]'
											/>
										) : (
											<ProductImagePlaceholder className='h-[70%] w-[70%]' />
										)}
									</div>
									<div className='p-3'>
										<h3 className='line-clamp-2 font-semibold leading-tight text-deep-tidal-teal-900'>{relatedProduct.name}</h3>
										<p className='mt-1 text-sm font-medium text-deep-tidal-teal-700'>
											{relatedVariants.length > 1 ? 'From ' : ''}C${relatedPrice.toFixed(2)}
										</p>
									</div>
								</Link>
							);
						})}
					</div>
				</section>
			)}
		</div>
	);
}
