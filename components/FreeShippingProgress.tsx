'use client';

import { Package } from 'lucide-react';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/constants';

type FreeShippingProgressProps = {
	subtotal: number;
};

export default function FreeShippingProgress({ subtotal }: FreeShippingProgressProps) {
	const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
	const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
	const isUnlocked = subtotal >= FREE_SHIPPING_THRESHOLD;

	return (
		<div
			className={`backdrop-blur-sm rounded-lg px-5 py-3 shadow-sm mb-6 transition-colors duration-300 ${
				isUnlocked ? 'bg-deep-tidal-teal/10 ring-1 ring-deep-tidal-teal/20' : 'bg-mineral-white ui-border'
			}`}>
			<div className='flex items-center gap-4'>
				{/* Truck icon in circular badge */}
				<div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${isUnlocked ? 'bg-deep-tidal-teal' : 'bg-eucalyptus/15'}`}>
					<Package className={`w-5 h-5 ${isUnlocked ? 'text-white' : 'text-eucalyptus'}`} />
				</div>

				{/* Message and progress bar */}
				<div className='flex-1 min-w-0'>
					<div className='flex items-center gap-2 mb-1.5'>
						{isUnlocked ? (
							<span className='font-bold text-sm text-deep-tidal-teal-800'>You&apos;ve unlocked FREE shipping!</span>
						) : (
							<span className='font-semibold text-sm text-eucalyptus'>You&apos;re ${remaining.toFixed(2)} away from FREE shipping</span>
						)}
					</div>
					<div className={`w-full rounded-full h-1.5 overflow-hidden ${isUnlocked ? 'bg-deep-tidal-teal/15' : 'bg-eucalyptus/15'}`}>
						<div
							className={`h-full rounded-full transition-all duration-500 ease-out ${isUnlocked ? 'bg-deep-tidal-teal' : 'bg-eucalyptus'}`}
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
