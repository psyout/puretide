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
			<div className=' overflow-hidden'>
				<button
					onClick={() => setDescriptionOpen(!descriptionOpen)}
					className={`w-full flex items-center justify-between px-0 md:px-4 py-3 transition-colors md:hover:bg-deep-tidal-teal/10 ${descriptionOpen ? 'border-b border-deep-tidal-teal/90' : ''}`}>
					<span className='text-md font-bold text-deep-tidal-teal-700 tracking-wider'>Description</span>
					<ChevronDown className={`w-4 h-4 text-deep-tidal-teal-600 transition-transform duration-200 ${descriptionOpen ? 'rotate-180' : ''}`} />
				</button>
				<div className={`overflow-hidden transition-all duration-200 min-h-0 border-b border-deep-tidal-teal/90 ${descriptionOpen ? 'max-h-96' : 'max-h-0'}`}>
					<p className='px-0 md:px-4 py-3 text-[clamp(0.9rem,3.8vw,0.95rem)] leading-[clamp(1rem,5.2vw,1.4rem)] text-deep-tidal-teal-700 tracking-normal text-pretty break-normal hyphens-none text-left lg:[text-align:justify] lg:hyphens-auto lg:[hyphenate-character:""] [word-break:normal] [overflow-wrap:normal]'>
						{description}
					</p>
				</div>
			</div>

			{/* Details - Accordion */}
			{details && (
				<div className='overflow-hidden'>
					<button
						onClick={() => setDetailsOpen(!detailsOpen)}
						className={`w-full flex items-center justify-between px-0 md:px-4 py-3 transition-colors md:hover:bg-deep-tidal-teal/10 border-deep-tidal-teal/90 ${detailsOpen ? '' : 'border-b border-deep-tidal-teal/90'}`}>
						<span className='text-md font-bold text-deep-tidal-teal-700 tracking-wider '>Details</span>
						<ChevronDown className={`w-4 h-4 text-deep-tidal-teal-600 transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`} />
					</button>
					<div className={`overflow-hidden transition-all duration-200 min-h-0 ${detailsOpen ? 'max-h-96 border-t border-deep-tidal-teal/90' : 'max-h-0'} `}>
						<p className='px-0 md:px-4 py-3 text-[clamp(0.9rem,3.8vw,0.95rem)] leading-[clamp(1rem,5.2vw,1.4rem)] text-deep-tidal-teal-700 text-pretty break-normal hyphens-none text-left lg:[text-align:justify] lg:hyphens-auto lg:[hyphenate-character:""] [word-break:normal] [overflow-wrap:normal]'>
							{details}
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
