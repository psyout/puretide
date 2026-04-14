'use client';

import { useState } from 'react';
import { type SurveyData } from './HowDidYouHearSurvey';

interface OrderConfirmationSurveyProps {
	orderNumber: string;
	customerEmail: string;
}

const surveyOptions = [
	{ value: 'search' as const, label: 'Search Search' },
	{ value: 'social' as const, label: 'Social Media' },
	{ value: 'friends' as const, label: 'Friends' },
	{ value: 'ai' as const, label: 'AI Chat' },
	{ value: 'ads' as const, label: 'Ads' },
	{ value: 'other' as const, label: 'Other' },
];

export default function OrderConfirmationSurvey({ orderNumber, customerEmail }: OrderConfirmationSurveyProps) {
	const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
	const [otherText, setOtherText] = useState('');
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [shouldCollapse, setShouldCollapse] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedChoice) return;

		setIsSubmitting(true);
		setError(null);

		try {
			const surveyData: SurveyData = {
				choice: selectedChoice as any,
				...(selectedChoice === 'other' && { otherText: otherText.trim() }),
			};

			const response = await fetch('/api/survey', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					orderNumber,
					customerEmail,
					surveyData,
				}),
			});

			const result = await response.json();
			if (!response.ok) {
				throw new Error(result.error || 'Failed to submit survey');
			}

			setIsSubmitted(true);
			// Trigger collapse after animation completes (3 seconds)
			setTimeout(() => {
				setShouldCollapse(true);
			}, 3000);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to submit survey');
		} finally {
			setIsSubmitting(false);
		}
	};

	if (shouldCollapse) {
		return null; // Component is collapsed/hidden
	}

	if (isSubmitted) {
		return (
			<div className='rounded-lg bg-green-50 border border-green-200 p-4 text-left animate-fade-in-out mt-4'>
				<div className='flex items-center gap-2 mb-2'>
					<svg
						className='w-6 h-6 text-green-600'
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={2}
							d='M5 13l4 4L19 7'
						/>
					</svg>
					<h3 className='text-base font-semibold text-green-800'>Thank you for your feedback!</h3>
				</div>
				<p className='text-sm text-green-700'>Your response helps us improve our service.</p>
			</div>
		);
	}

	return (
		<div className='mt-12 pt-8 border-t border-deep-tidal-teal/10'>
			<div className='p-4 max-w-md'>
				<h3 className='text-base font-semibold text-deep-tidal-teal-800 mb-3 text-left'>How did you hear about us?</h3>

				<form
					onSubmit={handleSubmit}
					className='space-y-3'>
					<div className='grid grid-cols-2 gap-2'>
						{surveyOptions.map((option) => (
							<label
								key={option.value}
								className='flex items-center gap-2 cursor-pointer text-sm text-deep-tidal-teal-700 hover:text-deep-tidal-teal-900 transition-colors'>
								<input
									type='radio'
									name='hear-about-us'
									value={option.value}
									checked={selectedChoice === option.value}
									onChange={() => {
										setSelectedChoice(option.value);
										if (option.value !== 'other') {
											setOtherText('');
										}
										setError(null);
									}}
									className='w-4 h-4 rounded-full border-deep-tidal-teal/30 text-deep-tidal-teal focus:ring-deep-tidal-teal/50'
								/>
								<span>{option.label}</span>
							</label>
						))}
					</div>

					{selectedChoice === 'other' && (
						<div className='mt-3'>
							<input
								type='text'
								value={otherText}
								onChange={(e) => {
									setOtherText(e.target.value);
									setError(null);
								}}
								placeholder='Please specify...'
								className='w-full bg-white border border-deep-tidal-teal/20 rounded px-3 py-2 text-sm text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-1 focus:ring-deep-tidal-teal/20'
							/>
						</div>
					)}

					{error && <div className='rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800'>{error}</div>}

					<button
						type='submit'
						disabled={!selectedChoice || isSubmitting}
						className='w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 disabled:bg-deep-tidal-teal/40 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg px-4 py-2 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]'>
						{isSubmitting ? (
							<span className='flex items-center justify-center gap-2'>
								<svg
									className='animate-spin h-4 w-4'
									viewBox='0 0 24 24'>
									<circle
										className='opacity-25'
										cx='12'
										cy='12'
										r='10'
										stroke='currentColor'
										strokeWidth='4'
										fill='none'
									/>
									<path
										className='opacity-75'
										fill='currentColor'
										d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
									/>
								</svg>
								Submitting...
							</span>
						) : (
							'Submit'
						)}
					</button>
				</form>
			</div>
		</div>
	);
}
