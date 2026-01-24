'use client';

import { Product } from '@/types/product';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';

interface ProductCardProps {
	product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
	const { addToCart } = useCart();
	const isSoldOut = product.stock <= 0 || product.status === 'stock-out';

	return (
		<div className='bg-white/60 backdrop-blur-sm rounded-lg ui-border hover:shadow-2xl hover:scale-103 transition-all duration-300 overflow-hidden group shadow-lg relative'>
			{isSoldOut && <span className='absolute top-4 right-4 text-xs font-semibold uppercase tracking-wide bg-deep-tidal-teal text-mineral-white px-2 py-1 rounded-full z-10'>Sold out</span>}
			<Link href={`/product/${product.slug}`}>
				<div className='p-6'>
					<div className='mb-6 text-center duration-300 flex justify-center items-center h-56'>
						{product.image.startsWith('/') || product.image.startsWith('http') ? (
							<div className='relative h-52 w-52'>
								<Image
									src={product.image}
									alt={product.name}
									fill
									sizes='208px'
									unoptimized={product.image.startsWith('http')}
									className='object-contain drop-shadow-xl drop-shadow-red'
									priority
								/>
							</div>
						) : (
							<span
								className='text-5xl'
								style={{ width: 'auto', height: 'auto' }}>
								{product.image}
							</span>
						)}
					</div>
					<h3 className='text-xl font-extrabold text-deep-tidal-teal-700 group-hover:text-deep-tidal-teal transition-colors'>{product.name}</h3>
					<p className='text-deep-tidal-teal-600 text-md mb-6 line-clamp-2'>{product.description}</p>
					<div className='flex justify-between items-center'>
						<span className='text-2xl font-bold text-deep-tidal-teal'>${product.price.toFixed(2)}</span>
					</div>
				</div>
			</Link>
			<div className='absolute inset-0 bg-white/30 backdrop-blur-[2px] opacity-0 transition-opacity duration-300 pointer-events-none group-hover:opacity-100' />
			<div className='absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 pointer-events-none group-hover:opacity-100'>
				{!isSoldOut && (
					<button
						onClick={(e) => {
							e.preventDefault();
							addToCart(product);
						}}
						className='pointer-events-auto bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors cursor-pointer'>
						Add to cart
					</button>
				)}
			</div>
		</div>
	);
}
