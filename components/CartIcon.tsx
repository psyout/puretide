'use client';

import { useState, useEffect, useRef } from 'react';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';

export default function CartIcon() {
	const { cartItems } = useCart();
	const [mounted, setMounted] = useState(false);
	const [isAnimate, setIsAnimate] = useState(false);
	const prevCountRef = useRef(0);

	const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

	useEffect(() => {
		setMounted(true);
		prevCountRef.current = cartItems.reduce((sum, item) => sum + item.quantity, 0);
	}, [cartItems]);

	useEffect(() => {
		if (mounted && itemCount > prevCountRef.current) {
			setIsAnimate(true);
			const timer = setTimeout(() => setIsAnimate(false), 600);
			return () => clearTimeout(timer);
		}
		prevCountRef.current = itemCount;
	}, [itemCount, mounted]);

	return (
		<Link
			href='/cart'
			className='relative inline-flex items-center justify-center transition-colors duration-300'>
			<svg
				className={`w-8 h-7 transition-colors duration-300 ${isAnimate ? 'text-eucalyptus-500' : 'text-current'}`}
				fill='none'
				stroke='currentColor'
				viewBox='0 0 24 24'>
				<path
					strokeLinecap='round'
					strokeLinejoin='round'
					strokeWidth={2}
					d='M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z'
				/>
			</svg>
			{mounted && itemCount > 0 && (
				<span
					key={itemCount}
					className={`absolute top-0 right-0 bg-mineral-white text-deep-tidal-teal text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm z-10 translate-x-1/2 -translate-y-1/2 transition-colors duration-300 ${
						isAnimate ? 'bg-eucalyptus-500 text-mineral-white' : ''
					}`}>
					{itemCount}
				</span>
			)}
		</Link>
	);
}
