'use client';

import React from 'react';
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';

interface PromoBannerProps {
	message?: string;
	cta?: string;
	onCtaClick: () => void;
	ctaButtonRef?: React.RefObject<HTMLButtonElement>;
	onHeightChange?: (height: number) => void;
}

const PromoBanner = forwardRef<HTMLDivElement, PromoBannerProps>(({ message, cta = 'Get 10% OFF', onCtaClick, ctaButtonRef, onHeightChange }, ref) => {
	const [isMounted, setIsMounted] = useState(false);
	const internalRef = useRef<HTMLDivElement>(null);

	// Forward ref
	useImperativeHandle(ref, () => internalRef.current!);

	// Report height changes
	useEffect(() => {
		if (internalRef.current && onHeightChange) {
			onHeightChange(internalRef.current.offsetHeight);
		}
	}, [onHeightChange]);

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
			className='bg-eucalyptus-50/100 text-white'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-row sm:flex-row items-center justify-end gap-2 sm:gap-4'>
				<p className='text-sm sm:text-sm text-right text-deep-tidal-teal-700'>
					{message ?? (
						<>
							<span className='sm:hidden'>Claim your exclusive discount code</span>
							<span className='hidden sm:inline'>Claim 10% OFF your first order. Enter your email to receive your exclusive discount code instantly</span>
						</>
					)}
				</p>
				<div className='flex items-center flex-shrink-0'>
					<button
						ref={ctaButtonRef}
						type='button'
						onClick={onCtaClick}
						className='bg-muted-sage-100 text-deep-tidal-teal-700 px-4 py-1 rounded text-sm font-semibold hover:bg-muted-sage-200 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-deep-tidal-teal-700'>
						{cta}
					</button>
				</div>
			</div>
		</motion.div>
	);
});

PromoBanner.displayName = 'PromoBanner';

export default PromoBanner;
