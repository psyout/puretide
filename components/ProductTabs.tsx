type ProductInfoProps = {
	description: string;
	details?: string;
};

export default function ProductTabs({ description, details }: ProductInfoProps) {
	return (
		<div className='space-y-3'>
			{/* Description */}
			<p className='pt-4 text-[16px] mb-2 text-deep-tidal-teal-700 leading-relaxed'>{description}</p>

			{/* Details */}
			<p className='text-[16px] text-deep-tidal-teal-800 leading-relaxed pt-2 border-t border-deep-tidal-teal/10'>{details}</p>
		</div>
	);
}
