'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

type ProductInfoProps = {
	description: string;
	details?: string;
};

export default function ProductTabs({ description, details }: ProductInfoProps) {
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [descriptionOpen, setDescriptionOpen] = useState(true);

	return (
		<div className='space-y-2 flex flex-col gap-2'>
			{/* Description - Accordion */}
			<div className='border border-deep-tidal-teal/10 bg-mineral-white shadow-sm rounded-lg overflow-hidden'>
				<button
					onClick={() => setDescriptionOpen(!descriptionOpen)}
					className={`w-full flex items-center justify-between px-4 py-3 bg-deep-tidal-teal/5 hover:bg-deep-tidal-teal/10 transition-colors ${descriptionOpen ? 'border-b border-deep-tidal-teal/10' : ''}`}>
					<span className='text-sm font-bold text-deep-tidal-teal-700 tracking-wider'>Description</span>
					<ChevronDown className={`w-4 h-4 text-deep-tidal-teal-600 transition-transform duration-200 ${descriptionOpen ? 'rotate-180' : ''}`} />
				</button>
				<div className={`overflow-hidden transition-all duration-200 min-h-0 ${descriptionOpen ? 'max-h-96' : 'max-h-0'} bg-mineral-white`}>
					<p className='px-4 py-3 text-[clamp(0.95rem,3.8vw,1rem)] leading-[clamp(1.45rem,5.2vw,1.65rem)] text-deep-tidal-teal-700 tracking-normal break-words hyphens-auto text-wrap'>
						{description}
					</p>
				</div>
			</div>

			{/* Details - Accordion */}
			{details && (
				<div className='border border-deep-tidal-teal/10 bg-mineral-white shadow-sm rounded-lg overflow-hidden'>
					<button
						onClick={() => setDetailsOpen(!detailsOpen)}
						className={`w-full flex items-center justify-between px-4 py-3 bg-deep-tidal-teal/5 hover:bg-deep-tidal-teal/10 transition-colors ${detailsOpen ? 'border-b border-deep-tidal-teal/10' : ''}`}>
						<span className='text-sm font-bold text-deep-tidal-teal-700 tracking-wider '>Details</span>
						<ChevronDown className={`w-4 h-4 text-deep-tidal-teal-600 transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`} />
					</button>
					<div className={`overflow-hidden transition-all duration-200 min-h-0 ${detailsOpen ? 'max-h-96' : 'max-h-0'} bg-mineral-white`}>
						<p className='px-4 py-3 text-[clamp(0.95rem,3.8vw,1rem)] leading-[clamp(1.45rem,5.2vw,1.65rem)] text-deep-tidal-teal-700 text-wrap break-words hyphens-auto'>{details}</p>
					</div>
				</div>
			)}
		</div>
	);
}
