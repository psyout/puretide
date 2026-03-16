'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { crossSellProducts, type CrossSellProduct } from '@/lib/crossSell';
import { useCart } from '@/context/CartContext';
import { hasProductImage } from '@/lib/productImage';
import { iconMap } from '@/lib/productIcons';
import ProductImagePlaceholder from './ProductImagePlaceholder';

interface CrossSellSectionProps {
	className?: string;
}

export default function CrossSellSection({ className = '' }: CrossSellSectionProps) {
	const { addToCart, cartItems } = useCart();
	const [addingProductId, setAddingProductId] = useState<string | null>(null);
	const [isVisible, setIsVisible] = useState(false); // Start hidden
	const [shouldHide, setShouldHide] = useState(false);

	// Show popup after page load
	useEffect(() => {
		const timer = setTimeout(() => {
			setIsVisible(true);
		}, 1000); // Show after 1 second

		return () => clearTimeout(timer);
	}, []);

	// Check if Bacteriostatic Water is already in cart
	const bacteriostaticWaterInCart = cartItems.some((item) => item.slug === 'bacteriostatic-water');

	// Don't show if water is already in cart
	if (bacteriostaticWaterInCart || shouldHide) {
		return null;
	}

	const handleAddToCart = async (product: CrossSellProduct) => {
		setAddingProductId(product.id);
		try {
			await addToCart(product, 1);
		} catch (error) {
			console.error('Failed to add cross-sell product to cart:', error);
		} finally {
			setAddingProductId(null);
		}
	};

	return (
		<AnimatePresence>
			{!shouldHide && (
				<motion.div
					initial={{ opacity: 0, y: -20, height: 0 }}
					animate={{ opacity: 1, y: 0, height: 'auto' }}
					exit={{ opacity: 0, y: -20, height: 0 }}
					transition={{ duration: 0.8, ease: 'easeOut' }}
					className={`border-b border-deep-tidal-teal/10 pb-3 mb-5 space-y-2 ${className} overflow-hidden`}>
					<div className='flex items-center justify-between mb-4'>
						<h3 className='text-md font-bold text-deep-tidal-teal-800 flex items-center gap-2'>Did you get yout Bacteriostatic Water?</h3>
						<button
							onClick={() => setShouldHide(true)}
							className='text-deep-tidal-teal-400 hover:text-deep-tidal-teal-600 transition-colors p-1 rounded hover:bg-deep-tidal-teal/10'
							aria-label='Hide cross-sell section'>
							<X className='w-4 h-4' />
						</button>
					</div>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.5, duration: 0.5 }}
						className='space-y-3'>
						{crossSellProducts.map((product) => (
							<div
								key={product.id}
								className='flex items-center gap-3 p-3 bg-white rounded-lg border border-deep-tidal-teal/10 hover:border-deep-tidal-teal/20 transition-colors'>
								{/* Product Image */}
								<Link
									href={`/product/${product.slug}`}
									className='w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors'>
									{hasProductImage(product.image) ? (
										<Image
											src={product.image}
											alt={product.name}
											width={64}
											height={64}
											className='w-full h-full object-contain'
											unoptimized={product.image.startsWith('http')}
										/>
									) : (
										<ProductImagePlaceholder className='w-16 h-16' />
									)}
								</Link>

								{/* Product Info */}
								<div className='flex-1 min-w-0'>
									<div className='flex items-start justify-between gap-2'>
										<div className='flex-1'>{product.description && <p className='text-xs text-deep-tidal-teal-600 mt-1 line-clamp-2'>{product.description}</p>}</div>
										{product.savings && (
											<span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-500 text-white flex-shrink-0'>{product.savings}</span>
										)}
									</div>
									<div className='flex items-center justify-between mt-2'>
										<div className='flex items-center gap-2'>
											<span className='text-lg font-bold text-deep-tidal-teal'>${product.price.toFixed(2)}</span>
											{product.originalPrice && <span className='text-xs text-deep-tidal-teal-500 line-through'>${product.originalPrice.toFixed(2)}</span>}
										</div>
										<button
											onClick={() => handleAddToCart(product)}
											disabled={addingProductId === product.id}
											className='inline-flex items-center gap-1 px-3 py-1.5 bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 disabled:bg-deep-tidal-teal/50 text-white text-sm font-medium rounded transition-colors disabled:cursor-not-allowed'>
											<Plus className='w-3 h-3' />
											{addingProductId === product.id ? 'Adding...' : 'Add'}
										</button>
									</div>
								</div>
							</div>
						))}
					</motion.div>
					<p className='text-xs text-deep-tidal-teal-500 mt-3 italic'>Perfect for your peptide reconstitution</p>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
