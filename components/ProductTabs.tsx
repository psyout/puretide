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
			<div className='border border-deep-tidal-teal/10 rounded-lg overflow-hidden'>
				<button
					onClick={() => setDescriptionOpen(!descriptionOpen)}
					className='w-full flex items-center justify-between px-4 py-3 bg-deep-tidal-teal/5 hover:bg-deep-tidal-teal/10 transition-colors'>
					<span className='text-sm font-bold text-deep-tidal-teal-700 tracking-wider'>Description</span>
					<ChevronDown className={`w-4 h-4 text-deep-tidal-teal-600 transition-transform duration-200 ${descriptionOpen ? 'rotate-180' : ''}`} />
				</button>
				<div className={`overflow-hidden transition-all duration-200 min-h-0 ${descriptionOpen ? 'max-h-96' : 'max-h-0'} bg-mineral-white`}>
					<p className='px-4 py-3 text-[15px] text-deep-tidal-teal-700 text-pretty tracking-normal break-words hyphens-auto'>{description}</p>
				</div>
			</div>

			{/* Details - Accordion */}
			{details && (
				<div className='border border-deep-tidal-teal/10 rounded-lg overflow-hidden'>
					<button
						onClick={() => setDetailsOpen(!detailsOpen)}
						className='w-full flex items-center justify-between px-4 py-3 bg-deep-tidal-teal/5 hover:bg-deep-tidal-teal/10 transition-colors'>
						<span className='text-sm font-bold text-deep-tidal-teal-700 tracking-wider '>Details</span>
						<ChevronDown className={`w-4 h-4 text-deep-tidal-teal-600 transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`} />
					</button>
					<div className={`overflow-hidden transition-all duration-200 min-h-0 ${detailsOpen ? 'max-h-96' : 'max-h-0'} bg-mineral-white`}>
						<p className='px-4 py-3 text-[15px] text-deep-tidal-teal-700 text-pretty break-words hyphens-auto'>{details}</p>
					</div>
				</div>
			)}
		</div>
	);
}
