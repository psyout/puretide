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

	return (
		<div className='bg-mineral-white backdrop-blur-sm rounded-lg border border-black/10 hover:shadow-2xl hover:scale-103 transition-all duration-300 overflow-hidden group shadow-lg'>
			<Link href={`/product/${product.slug}`}>
				<div className='p-8'>
					<div className='mb-6 text-center duration-300 flex justify-center items-center h-56'>
						{product.image.startsWith('/') || product.image.startsWith('http') ? (
							<Image
								src={product.image}
								alt={product.name}
								width={260}
								height={208}
								unoptimized={product.image.startsWith('http')}
								className='max-h-52 w-auto object-contain drop-shadow-xl drop-shadow-red'
							/>
						) : (
							<span className='text-6xl'>{product.image}</span>
						)}
					</div>
					<h3 className='text-xl font-extrabold mb-3 text-deep-tidal-teal-700 group-hover:text-deep-tidal-teal transition-colors'>{product.name}</h3>
					<p className='text-muted-sage-600 text-md mb-6 line-clamp-2 leading-relaxed'>{product.description}</p>
					<div className='flex justify-between items-center'>
						<span className='text-2xl font-bold text-deep-tidal-teal'>${product.price.toFixed(2)}</span>
					</div>
				</div>
			</Link>
			<div className='px-8 pb-8'>
				<button
					onClick={(e) => {
						e.preventDefault();
						addToCart(product);
					}}
					className='w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-4 rounded transition-colors'>
					Add to Cart
				</button>
			</div>
		</div>
	);
}
