'use client';

import React from 'react';
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PromoBannerProps {
	messages?: string[];
	cta?: string;
	onCtaClick: () => void;
	ctaButtonRef?: React.RefObject<HTMLButtonElement>;
	onHeightChange?: (height: number) => void;
}

const PromoBanner = forwardRef<HTMLDivElement, PromoBannerProps>(({ messages, cta = 'Get 10% OFF', onCtaClick, ctaButtonRef, onHeightChange }, ref) => {
	const [isMounted, setIsMounted] = useState(false);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isPaused, setIsPaused] = useState(false);
	const internalRef = useRef<HTMLDivElement>(null);

	const defaultMessages = [
		'Claim 10% OFF your first order. Enter your email to receive your exclusive discount code instantly 🎉 ',
		'Enjoy free shipping on all orders over $300 🚚',
		'All products are third-party tested in Canada for purity and quality ',
	];

	const bannerMessages = messages || defaultMessages;

	// Forward ref
	useImperativeHandle(ref, () => internalRef.current!);

	// Report height changes
	useEffect(() => {
		if (internalRef.current && onHeightChange) {
			onHeightChange(internalRef.current.offsetHeight);
		}
	}, [onHeightChange]);

	// Auto-rotate messages every 4.5 seconds
	useEffect(() => {
		if (isPaused || bannerMessages.length <= 1) return;

		const interval = setInterval(() => {
			setCurrentIndex((prev) => (prev + 1) % bannerMessages.length);
		}, 4500);

		return () => clearInterval(interval);
	}, [isPaused, bannerMessages.length]);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) return null;

	return (
		<motion.div
			ref={internalRef}
			initial={{ opacity: 0, y: -20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			onMouseEnter={() => setIsPaused(true)}
			onMouseLeave={() => setIsPaused(false)}
			className='bg-eucalyptus-50/100 text-white'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-row sm:flex-row items-center justify-end gap-2 sm:gap-4 min-h-[64px]'>
				<div className='flex-1 sm:flex-none overflow-hidden'>
					<AnimatePresence mode='wait'>
						<motion.p
							key={currentIndex}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -10 }}
							transition={{ duration: 0.4, ease: 'easeInOut' }}
							className='text-sm sm:text-sm text-right text-deep-tidal-teal-700'>
							{bannerMessages[currentIndex]}
						</motion.p>
					</AnimatePresence>
				</div>
				{currentIndex === 0 && (
					<div className='flex items-center flex-shrink-0'>
						<button
							ref={ctaButtonRef}
							type='button'
							onClick={onCtaClick}
							className='bg-muted-sage-100 text-deep-tidal-teal-700 px-3 py-1 rounded text-xs font-semibold hover:bg-muted-sage-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-deep-tidal-teal-700'>
							{cta}
						</button>
					</div>
				)}
			</div>
		</motion.div>
	);
});

PromoBanner.displayName = 'PromoBanner';

export default PromoBanner;
