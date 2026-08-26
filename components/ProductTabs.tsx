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
	const [detailsOpen, setDetailsOpen] = useState(false);
	const { copy, ctas } = parseProductDescription(description, productSlug);

	return (
		<div className='space-y-5 text-deep-tidal-teal-800'>
			<section className='border-t border-deep-tidal-teal/10 pt-5'>
				<h2 className='mb-2 text-lg font-bold tracking-tight'>About this product</h2>
				{copy && <p className='text-[0.95rem] leading-6 text-deep-tidal-teal-700 text-pretty'>{copy}</p>}
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
			</section>

			{details && (
				<section className='border-y border-deep-tidal-teal/10 py-5'>
					<button
						type='button'
						onClick={() => setDetailsOpen(!detailsOpen)}
						aria-expanded={detailsOpen}
						className='flex w-full items-center justify-between gap-3 py-1 text-left text-lg font-bold tracking-tight text-deep-tidal-teal-800 transition-colors hover:text-deep-tidal-teal-600'>
						<span>Research details</span>
						<ChevronDown className={`h-5 w-5 shrink-0 transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`} />
					</button>
					<div className={`grid transition-[grid-template-rows] duration-300 ease-out ${detailsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
						<div className='min-h-0 overflow-hidden'>
							<p className='pt-3 text-[0.95rem] leading-6 text-deep-tidal-teal-700 text-pretty'>{details}</p>
						</div>
					</div>
				</section>
			)}
		</div>
	);
}
