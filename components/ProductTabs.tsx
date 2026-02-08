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
					<span className='text-[15px] font-semibold text-deep-tidal-teal-800'>Description</span>
					<ChevronDown className={`w-4 h-4 text-deep-tidal-teal-600 transition-transform duration-200 ${descriptionOpen ? 'rotate-180' : ''}`} />
				</button>
				<div className={`overflow-hidden transition-all duration-200 ${descriptionOpen ? 'max-h-96' : 'max-h-0'}`}>
					<p className='px-4 py-3 text-[15px] text-deep-tidal-teal-700 text-pretty'>{description}</p>
				</div>
			</div>

			{/* Details - Accordion */}
			{details && (
				<div className='border border-deep-tidal-teal/10 rounded-lg overflow-hidden'>
					<button
						onClick={() => setDetailsOpen(!detailsOpen)}
						className='w-full flex items-center justify-between px-4 py-3 bg-deep-tidal-teal/5 hover:bg-deep-tidal-teal/10 transition-colors'>
						<span className='text-[15px] font-semibold text-deep-tidal-teal-800'>Details</span>
						<ChevronDown className={`w-4 h-4 text-deep-tidal-teal-600 transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`} />
					</button>
					<div className={`overflow-hidden transition-all duration-200 ${detailsOpen ? 'max-h-96' : 'max-h-0'}`}>
						<p className='px-4 py-3 text-[15px] text-deep-tidal-teal-700 text-pretty'>{details}</p>
					</div>
				</div>
			)}
		</div>
	);
}
