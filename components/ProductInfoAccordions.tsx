'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

type ProductInfoSection = 'details' | 'research' | 'shipping';

interface ProductInfoAccordionsProps {
	details?: string;
	freeShippingThreshold: number;
}

const RESEARCH_USE_NOTICE =
	'All compounds sold by Pure Tide are intended exclusively for laboratory and bench-research applications and are not for human or veterinary use. Nothing on this website should be interpreted as medical, dietary, diagnostic, or therapeutic advice. Research information is provided solely for scientific and educational reference.';

export default function ProductInfoAccordions({ details, freeShippingThreshold }: ProductInfoAccordionsProps) {
	const [openSection, setOpenSection] = useState<ProductInfoSection | null>('details');

	const sections: Array<{ id: ProductInfoSection; label: string; content: React.ReactNode }> = [
		{
			id: 'details',
			label: 'Details',
			content: <p>{details || 'Additional product details are not currently available.'}</p>,
		},
		{
			id: 'research',
			label: 'Research use only',
			content: <p>{RESEARCH_USE_NOTICE}</p>,
		},
		{
			id: 'shipping',
			label: 'Shipping',
			content: (
				<ul className='list-disc space-y-1.5 pl-5 marker:text-eucalyptus-600'>
					<li>Ships from our warehouse</li>
					<li>
						<strong className='font-semibold text-deep-tidal-teal-900'>Processing:</strong> 1–2 business days
					</li>
					<li>Free shipping over ${freeShippingThreshold}</li>
				</ul>
			),
		},
	];

	return (
		<div
			className='space-y-3'
			aria-label='Product information'>
			{sections.map((section) => {
				const isOpen = openSection === section.id;
				const panelId = `product-info-${section.id}`;

				return (
					<section
						key={section.id}
						className='overflow-hidden rounded-xl border border-deep-tidal-teal/15 bg-white'>
						<button
							type='button'
							onClick={() => setOpenSection(isOpen ? null : section.id)}
							aria-expanded={isOpen}
							aria-controls={panelId}
							className='flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-deep-tidal-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-deep-tidal-teal/40'>
							<span>{section.label}</span>
							{isOpen ? <Minus className='h-4 w-4 shrink-0' aria-hidden='true' /> : <Plus className='h-4 w-4 shrink-0' aria-hidden='true' />}
						</button>
						<div
							className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
								isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
							}`}
							aria-hidden={!isOpen}>
							<div className='overflow-hidden'>
							<div
								id={panelId}
								className='border-t border-deep-tidal-teal/10 px-5 pb-5 pt-4 text-sm leading-6 text-deep-tidal-teal-700'>
								{section.content}
							</div>
							</div>
						</div>
					</section>
				);
			})}
		</div>
	);
}
