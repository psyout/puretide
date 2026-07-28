'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

type CartItemDetailsProps = {
	description: string;
	details?: string;
};

export default function CartItemDetails({ description, details }: CartItemDetailsProps) {
	const [isOpen, setIsOpen] = useState(false);

	const content = details || description;

	return (
		<div className='mt-3'>
			<button
				type='button'
				onClick={() => setIsOpen(!isOpen)}
				className='flex items-center gap-2 text-sm font-semibold text-deep-tidal-teal-700 hover:text-deep-tidal-teal-900 transition-colors'
				aria-expanded={isOpen}
				aria-controls='cart-item-details'>
				{isOpen ? <ChevronUp className='w-4 h-4' /> : <ChevronDown className='w-4 h-4' />}
				<span>Product Details</span>
			</button>
			<div
				id='cart-item-details'
				className={`overflow-hidden transition-all duration-300 ease-out ${isOpen ? 'max-h-96 mt-2' : 'max-h-0'}`}>
				<p className='text-sm text-deep-tidal-teal-700 leading-relaxed'>{content}</p>
			</div>
		</div>
	);
}
