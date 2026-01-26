'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

type AccordionItem = {
	title: string;
	body: string;
};

type AboutAccordionProps = {
	items: AccordionItem[];
	defaultOpenIndex?: number | null;
};

export default function AboutAccordion({ items, defaultOpenIndex = 0 }: AboutAccordionProps) {
	const [openItem, setOpenItem] = useState<number | null>(defaultOpenIndex);

	return (
		<div className='space-y-3'>
			{items.map((item, index) => {
				const isOpen = openItem === index;
				return (
					<div
						key={item.title}
						className={`rounded-xl p-2 bg-mineral-white backdrop-blur-md shadow-sm overflow-hidden grid transition-[grid-template-rows] duration-300 ease-out ui-border text-lg ${
							isOpen ? 'grid-rows-[auto_1fr]' : 'grid-rows-[auto_0fr]'
						}`}>
						<button
							type='button'
							onClick={() => setOpenItem(isOpen ? null : index)}
							className='w-full flex items-center justify-between px-5 py-4 text-left text-deep-tidal-teal-800 font-semibold'>
							<span>{item.title}</span>
							{isOpen ? <Minus className='w-5 h-5 text-deep-tidal-teal' /> : <Plus className='w-5 h-5 text-deep-tidal-teal' />}
						</button>
						<div className='px-5 text-deep-tidal-teal-700 text-base overflow-hidden'>
							<div className={`pb-4 transition-opacity duration-300 ease-out text-md ${isOpen ? 'opacity-100' : 'opacity-0'}`}>{item.body}</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
