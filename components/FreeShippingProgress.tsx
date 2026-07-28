'use client';

import { Package } from 'lucide-react';

type FreeShippingProgressProps = {
	subtotal: number;
};

const FREE_SHIPPING_THRESHOLD = 300;

export default function FreeShippingProgress({ subtotal }: FreeShippingProgressProps) {
	const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
	const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
	const isUnlocked = subtotal >= FREE_SHIPPING_THRESHOLD;

	return (
		<div className='bg-mineral-white backdrop-blur-sm rounded-lg ui-border px-5 py-3 shadow-sm mb-6'>
			<div className='flex items-center gap-4'>
				{/* Truck icon in circular badge */}
				<div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${isUnlocked ? 'bg-eucalyptus/10' : 'bg-deep-tidal-teal/10'}`}>
					<Package className={`w-5 h-5 ${isUnlocked ? 'text-eucalyptus' : 'text-deep-tidal-teal'}`} />
				</div>

				{/* Message and progress bar */}
				<div className='flex-1 min-w-0'>
					<div className='flex items-center gap-2 mb-1.5'>
						{isUnlocked ? (
							<span className='font-semibold text-sm text-eucalyptus'>You&apos;ve unlocked FREE shipping!</span>
						) : (
							<span className='font-semibold text-sm text-deep-tidal-teal-800'>You&apos;re ${remaining.toFixed(2)} away from FREE shipping</span>
						)}
					</div>
					<div className='w-full bg-deep-tidal-teal/10 rounded-full h-1.5 overflow-hidden'>
						<div
							className={`h-full rounded-full transition-all duration-500 ease-out ${isUnlocked ? 'bg-eucalyptus' : 'bg-deep-tidal-teal'}`}
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
