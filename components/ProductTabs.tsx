'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { parseProductDescription } from '@/lib/productDescription';

type ProductInfoProps = {
	productSlug: string;
	description: string;
	details?: string;
};

export default function ProductTabs({ productSlug, description, details }: ProductInfoProps) {
	const [researchNoticeOpen, setResearchNoticeOpen] = useState(false);
	const { copy, ctas } = parseProductDescription(description, productSlug);

	return (
		<section className='text-deep-tidal-teal-800' aria-labelledby='product-overview-heading'>
			<h2 id='product-overview-heading' className='mb-3 text-2xl font-bold tracking-tight text-deep-tidal-teal-900'>Product overview</h2>
			<div className='space-y-3'>
				{copy && <p className='text-[0.95rem] leading-6 text-deep-tidal-teal-700 text-pretty'>{copy}</p>}
				{details && <p className='text-[0.95rem] leading-6 text-deep-tidal-teal-700 text-pretty'>{details}</p>}
				{ctas.map((cta) => (
					<p
						key={cta.href}
						className='mt-3 text-[0.95rem] leading-6 text-deep-tidal-teal-700'>
						Also available in{' '}
						<Link
							href={cta.href}
							className='font-semibold text-deep-tidal-teal underline decoration-deep-tidal-teal/40 underline-offset-4 transition-colors hover:text-eucalyptus'>
							{cta.label}
						</Link>
					</p>
				))}
			</div>

			<div className='mt-5 border-t border-deep-tidal-teal/10 pt-4'>
					<button
						type='button'
						onClick={() => setResearchNoticeOpen(!researchNoticeOpen)}
						aria-expanded={researchNoticeOpen}
						className='flex min-h-11 w-full items-center justify-between gap-3 py-1 text-left text-sm font-semibold tracking-tight text-deep-tidal-teal-800 transition-colors hover:text-deep-tidal-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep-tidal-teal/40'>
						<span>Important: Research Use Only</span>
						<ChevronDown className={`h-5 w-5 shrink-0 transition-transform duration-200 ${researchNoticeOpen ? 'rotate-180' : ''}`} />
					</button>
					<div className={`grid transition-[grid-template-rows] duration-300 ease-out ${researchNoticeOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
						<div className='min-h-0 overflow-hidden'>
							<p className='pt-3 text-sm leading-6 text-deep-tidal-teal-700 text-pretty'>
								All compounds sold by Pure Tide are intended exclusively for laboratory and bench-research applications and are not for human or veterinary use. Nothing on this
								website should be interpreted as medical, dietary, diagnostic, or therapeutic advice. Unless otherwise stated, Pure Tide products may be investigational
								compounds and have not received regulatory approval from Health Canada, the U.S. FDA, the EMA, or any equivalent body at this writing. Research information is
								provided solely for scientific and educational reference. Pure Tide does not provide dosing, administration, or application instructions. Purchasers are
								responsible for compliance with all applicable laws, regulations, and laboratory safety standards.
							</p>
						</div>
					</div>
			</div>
		</section>
	);
}
