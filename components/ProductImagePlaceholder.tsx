'use client';

type ProductImagePlaceholderProps = {
	className?: string;
	/** Optional size variant; className still wins for dimensions */
	size?: 'card' | 'page' | 'cart' | 'checkout';
};

/**
 * Placeholder shown when a product has no image URL yet (e.g. new row in Google Sheet or dashboard).
 * Same-size as real product images; use className to match container (e.g. w-36 h-36 md:w-52 md:h-52).
 */
export default function ProductImagePlaceholder({ className = '', size }: ProductImagePlaceholderProps) {
	const sizeClass =
		size === 'checkout'
			? 'w-14 h-14'
			: size === 'cart'
				? 'max-h-24 max-w-24 w-24 h-24'
				: size === 'page'
					? 'w-full h-auto max-h-[280px] lg:max-h-[500px]'
					: size === 'card'
						? 'w-36 h-36 md:w-52 md:h-52'
						: '';
	const combined = [sizeClass, className].filter(Boolean).join(' ');

	return (
		<div
			className={`flex items-center justify-center text-deep-tidal-teal-50 ${combined}`}
			aria-hidden
			role='img'
			aria-label='Product image coming soon'>
			<svg
				xmlns='http://www.w3.org/2000/svg'
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='1.5'
				strokeLinecap='round'
				strokeLinejoin='round'
				className='w-[60%] h-[60%] max-w-full max-h-full object-contain'>
				<rect
					width='18'
					height='18'
					x='3'
					y='3'
					rx='2'
					ry='2'
				/>
				<circle
					cx='9'
					cy='9'
					r='2'
				/>
				<path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' />
			</svg>
		</div>
	);
}
