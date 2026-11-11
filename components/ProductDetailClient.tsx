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
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';
import { parseProductDescription } from '@/lib/productDescription';
import { getProductDisplayName, isProductVariantSellable } from '@/lib/productVariant';
import ProductInfoAccordions from '@/components/ProductInfoAccordions';

interface ProductDetailClientProps {
	product: Product;
	description: string;
	details?: string;
	hasCoaFile: boolean;
	matchingCoaFile?: string;
	stockUnavailable?: boolean;
	relatedProducts?: Product[];
}

export default function ProductDetailClient({ product, description, details, hasCoaFile, matchingCoaFile, stockUnavailable = false, relatedProducts = [] }: ProductDetailClientProps) {
	const { automaticPromotion } = useCart();
	const variants = useMemo(() => product.variants || [], [product.variants]);
	const hasVariants = variants.length > 1;

	// Default selection: first in-stock variant, else first variant
	const defaultVariant = useMemo(() => {
		const firstInStock = variants.find(isProductVariantSellable);
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
	const displayImage = currentVariant?.image || product.image;
	const displaySubtitle = currentVariant?.subtitle ?? product.subtitle;
	const isSoldOut = currentVariant ? !isProductVariantSellable(currentVariant) : displayStock <= 0 || product.status === 'stock-out';
	const isPreOrder = product.slug === 'cartalax' || product.slug === 'dsip';
	const displayName = getProductDisplayName(product.name, displayMg, Boolean(currentVariant));
	const { copy: descriptionCopy, ctas: descriptionCtas } = parseProductDescription(description, product.slug);

	// For variant products, check if all variants are sold out
	const allVariantsSoldOut = hasVariants && variants.every((variant) => !isProductVariantSellable(variant));

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
				image: currentVariant.image || product.image,
				subtitle: currentVariant.subtitle ?? product.subtitle,
				zohoItemId: currentVariant.zohoItemId,
				sku: currentVariant.sku,
				cost: currentVariant.cost,
			};
		}
		return product;
	}, [product, currentVariant]);

	return (
		<div className='grid grid-cols-1 gap-y-6'>
			<div className='grid grid-cols-1 gap-y-6 md:grid-cols-2 md:items-start md:gap-x-8 lg:gap-x-10'>
				<div className='flex min-h-[300px] items-center justify-center rounded-2xl bg-gradient-to-br from-eucalyptus-50 via-mineral-white to-deep-tidal-teal/10 p-6 md:sticky md:top-24 md:min-h-[560px] md:self-start md:p-10'>
					{hasProductImage(displayImage) ? (
						<Image
							key={displayImage}
							src={displayImage}
							alt={displayName}
							width={500}
							height={500}
							style={{ width: 'auto', height: 'auto' }}
							unoptimized={displayImage.startsWith('http')}
							priority
							className='h-auto w-auto max-h-[280px] max-w-full object-contain drop-shadow-xl transition-all duration-300 md:max-h-[400px] md:max-w-[400px] lg:max-h-[500px]'
						/>
					) : (
						<ProductImagePlaceholder className='h-auto w-auto max-h-[280px] object-contain md:max-h-[400px] lg:max-h-[500px]' />
					)}
				</div>

				<div className='min-w-0 md:w-full md:px-0'>
					{/* Sold out badge */}
					{(isSoldOut || allVariantsSoldOut) && (
						<div className='mb-4'>
							<span className='text-xs font-semibold uppercase tracking-wide bg-deep-tidal-teal text-mineral-white px-2 py-1 rounded-md'>Sold out</span>
						</div>
					)}

					{/* Product name and mg */}
					<div className='mt-1 md:mt-0'>
						<h1 className='text-xl font-bold leading-tight text-deep-tidal-teal-700 md:text-3xl'>{displayName}</h1>
					</div>
					{displaySubtitle && <p className='mb-4 text-[0.9rem] font-medium text-deep-tidal-teal-600 md:text-md'>{displaySubtitle}</p>}
					{!displaySubtitle && <div className='mb-1' />}

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
							<span className={`text-2xl font-bold md:text-3xl ${saleDiscount > 0 ? 'text-[#b42318]' : ''}`}>
								<span className='text-[1.5rem] font-light md:text-[1.75rem]'>C</span>${salePrice.toFixed(2)}
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
						<div className='mb-5 border-b border-deep-tidal-teal/15 pb-5 text-[0.9rem] md:text-[0.95rem] text-pretty leading-6 text-deep-tidal-teal-700'>
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

					{/* Strength selector - keep every option visible */}
					{hasVariants && (
						<fieldset className='mb-6'>
							<legend className='mb-2 block text-sm font-semibold text-deep-tidal-teal-700'>Strength</legend>
							<div
								className='flex flex-wrap gap-2'
								role='radiogroup'
								aria-label='Strength'>
								{variants.map((variant) => {
									const isSelected = selectedVariant?.key === variant.key;
									const isVariantSoldOut = !isProductVariantSellable(variant);
									return (
										<label
											key={variant.key}
											className={`relative inline-flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition focus-within:outline-none focus-within:ring-2 focus-within:ring-deep-tidal-teal/30 focus-within:ring-offset-2 ${
												isSelected
													? 'border-deep-tidal-teal-700 bg-deep-tidal-teal-700 text-white shadow-sm'
													: 'border-deep-tidal-teal/25 bg-white text-deep-tidal-teal-800 hover:border-deep-tidal-teal/55 hover:bg-eucalyptus-50'
											} ${isVariantSoldOut ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
											<input
												type='radio'
												name='product-strength'
												value={variant.key}
												checked={isSelected}
												onChange={() => handleVariantChange(variant.key)}
												disabled={isVariantSoldOut}
												className='sr-only'
											/>
											<span>{variant.label}</span>
											{isVariantSoldOut && <span className='ml-1.5 text-[0.65rem] font-medium uppercase tracking-wide'>Sold out</span>}
										</label>
									);
								})}
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
								<strong>Inventory System Offline:</strong> Real-time stock data is temporarily unavailable. Please try again later or contact us for availability before placing
								an order.
							</p>
						</div>
					)}

					<div className='mb-6'>
						<ProductActions product={productForActions} />
					</div>

					{/* COA */}
					{hasCoaFile && (
						<div className='lab-assurance mb-5 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-deep-tidal-teal-700'>
							<span className='inline-flex items-center gap-2 font-semibold'>
								<span
									className='relative inline-flex h-6 w-6 shrink-0 items-center justify-center'
									aria-hidden='true'>
									<FlaskConical className='lab-flask-icon h-5 w-5' />
									<span className='lab-bubble' />
									<span className='lab-bubble' />
									<span className='lab-bubble' />
								</span>
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
								className='lab-report-link inline-flex min-h-11 items-center rounded-sm font-semibold hover:text-deep-tidal-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep-tidal-teal/40 focus-visible:ring-offset-2'>
								View lab report
							</Link>
						</div>
					)}

					<ProductInfoAccordions
						details={details}
						freeShippingThreshold={FREE_SHIPPING_THRESHOLD}
					/>
				</div>
			</div>

			<section
				aria-label='Store assurances'
				className='order-2 col-span-full mt-10 grid grid-cols-1 border-t border-deep-tidal-teal/15 sm:grid-cols-3 sm:divide-x sm:divide-deep-tidal-teal/15'>
				<div className='flex min-w-0 flex-col items-center justify-center gap-2 border-b border-deep-tidal-teal/15 px-2 py-10 text-center sm:border-b-0 sm:px-4'>
					<Truck
						className='h-12 w-12 shrink-0 rounded-full bg-eucalyptus-100 p-2.5 text-eucalyptus-600'
						aria-hidden='true'
					/>
					<span className='text-[0.9rem] font-semibold leading-tight text-deep-tidal-teal-800 sm:text-sm'>Fast shipping</span>
				</div>
				<div className='flex min-w-0 flex-col items-center justify-center gap-2 border-b border-deep-tidal-teal/15 px-2 py-10 text-center sm:border-b-0 sm:px-4 sm:py-6'>
					<ShieldCheck
						className='h-12 w-12 shrink-0 rounded-full bg-eucalyptus-100 p-2.5 text-eucalyptus-600'
						aria-hidden='true'
					/>
					<span className='text-[0.9rem] font-semibold leading-tight text-deep-tidal-teal-800 sm:text-sm'>Quality assured</span>
				</div>
				<div className='flex min-w-0 flex-col items-center justify-center gap-2 px-2 py-10 text-center sm:px-4 sm:py-6'>
					<CreditCard
						className='h-12 w-12 shrink-0 rounded-full bg-eucalyptus-100 p-2.5 text-eucalyptus-600'
						aria-hidden='true'
					/>
					<span className='text-[0.9rem] font-semibold leading-tight text-deep-tidal-teal-800 sm:text-sm'>Secure checkout</span>
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
					className='order-5 col-span-full border-t border-deep-tidal-teal/15 pt-6 mb-10'
					aria-labelledby='related-products-heading'>
					<h2
						id='related-products-heading'
						className='my-4 text-2xl font-semibold text-deep-tidal-teal-900'>
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
