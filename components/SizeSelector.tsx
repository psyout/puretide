'use client';

import { useState } from 'react';

export default function SizeSelector() {
	const [selectedSize, setSelectedSize] = useState<'10mg' | '40mg'>('40mg');

	const handleSizeChange = (size: '10mg' | '40mg') => {
		setSelectedSize(size);
		console.log('Selected size:', size);
	};

	return (
		<fieldset className='mb-6'>
			<div className='flex items-center gap-3 mt-2'>
				<legend className='text-md font-semibold text-deep-tidal-teal-700 mb-0'>Choose Size:</legend>
				<div
					className='inline-flex rounded-xl bg-white shadow-sm ui-border overflow-hidden'
					role='radiogroup'
					aria-label='Size'>
					<label
						className={`relative cursor-pointer select-none px-4 py-2.5 text-sm font-semibold transition-colors focus-within:outline-none ${
							selectedSize === '10mg' ? 'bg-deep-tidal-teal-700 text-mineral-white' : 'bg-white text-deep-tidal-teal-700 hover:bg-deep-tidal-teal/5'
						}`}
						aria-label='10mg'>
						<input
							type='radio'
							name='size'
							value='10mg'
							checked={selectedSize === '10mg'}
							onChange={() => handleSizeChange('10mg')}
							className='sr-only'
						/>
						10mg
					</label>
					<label
						className={`relative cursor-pointer select-none px-4 py-2.5 text-sm font-semibold transition-colors focus-within:outline-none border-l ui-border ${
							selectedSize === '40mg' ? 'bg-deep-tidal-teal-700 text-mineral-white' : 'bg-white text-deep-tidal-teal-700 hover:bg-deep-tidal-teal/5'
						}`}
						aria-label='40mg'>
						<input
							type='radio'
							name='size'
							value='40mg'
							checked={selectedSize === '40mg'}
							onChange={() => handleSizeChange('40mg')}
							className='sr-only'
						/>
						40mg
					</label>
				</div>
			</div>
		</fieldset>
	);
}
