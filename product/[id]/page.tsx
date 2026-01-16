'use client';

import { products } from '@/lib/products';
import { useCart } from '@/context/CartContext';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProductPage() {
	const params = useParams();
	const router = useRouter();
	const { addToCart } = useCart();
	const product = products.find((p) => p.id === params.id);

	if (!product) {
		return (
			<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
				<div className='container mx-auto px-4 py-12'>
					<h1 className='text-4xl font-bold mb-4 text-deep-tidal-teal-800'>Product not found</h1>
					<Link
						href='/'
						className='text-deep-tidal-teal hover:text-eucalyptus'>
						← Back to Products
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<div className='container mx-auto px-4 py-12'>
				<Link
					href='/'
					className='text-deep-tidal-teal hover:text-eucalyptus mb-8 inline-block'>
					← Back to Products
				</Link>

				<div className='grid grid-cols-1 lg:grid-cols-2 gap-12'>
					<div className='bg-eucalyptus-100/60 backdrop-blur-sm rounded-lg border border-muted-sage-400 p-12 flex items-center justify-center shadow-lg'>
						{product.image.startsWith('/') || product.image.startsWith('http') ? (
							<img
								src={product.image}
								alt={product.name}
								className='max-w-full max-h-96 w-auto object-contain'
							/>
						) : (
							<div className='text-9xl'>{product.image}</div>
						)}
					</div>

					<div>
						<span className='text-sm text-muted-sage-700 bg-eucalyptus-200 px-3 py-1 rounded inline-block mb-4'>{product.category}</span>
						<h1 className='text-4xl font-bold mb-4 text-deep-tidal-teal-800'>{product.name}</h1>
						<p className='text-deep-tidal-teal-700 text-lg mb-6'>{product.description}</p>
						<div className='text-4xl font-bold text-deep-tidal-teal mb-8'>${product.price.toFixed(2)}</div>

						<div className='space-y-4'>
							<button
								onClick={() => {
									addToCart(product);
									router.push('/cart');
								}}
								className='w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-4 px-6 rounded transition-colors text-lg'>
								Add to Cart
							</button>
							<div className='bg-eucalyptus-100/60 p-4 rounded border border-muted-sage-400 shadow-md'>
								<div className='flex items-center gap-2 mb-2'>
									<svg className='w-5 h-5 text-deep-tidal-teal' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
									</svg>
									<h3 className='font-semibold text-deep-tidal-teal-800'>Privacy Guaranteed</h3>
								</div>
								<p className='text-sm text-deep-tidal-teal-700'>This purchase is completely anonymous. No tracking, no data collection, no third-party sharing.</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
