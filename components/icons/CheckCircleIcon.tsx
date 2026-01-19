interface CheckCircleIconProps {
	className?: string;
}

export default function CheckCircleIcon({ className = 'w-12 h-12 text-deep-tidal-teal' }: CheckCircleIconProps) {
	return (
		<svg
			className={className}
			fill='none'
			stroke='currentColor'
			viewBox='0 0 24 24'>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={1.5}
				d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
			/>
		</svg>
	);
}
