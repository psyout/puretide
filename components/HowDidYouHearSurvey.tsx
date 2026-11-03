'use client';

import { useState } from 'react';

export type SurveyChoice = 'search' | 'social' | 'word' | 'ai';

interface SurveyOption {
	value: SurveyChoice;
	label: string;
}

export interface SurveyData {
	choice: SurveyChoice;
}

interface HowDidYouHearSurveyProps {
	onSubmit?: (data: SurveyData) => Promise<void> | void;
	required?: boolean;
	defaultValue?: SurveyChoice;
	className?: string;
}

const surveyOptions: SurveyOption[] = [
	{ value: 'search', label: 'Google Search' },
	{ value: 'social', label: 'Facebook Ads' },
	{ value: 'word', label: 'Word of Mouth' },
	{ value: 'ai', label: 'AI Chat' },
];

export default function HowDidYouHearSurvey({ onSubmit, required = false, defaultValue, className = '' }: HowDidYouHearSurveyProps) {
	const [selectedChoice, setSelectedChoice] = useState<SurveyChoice | null>(defaultValue ?? null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (required && !selectedChoice) {
			setError('Please select how you heard about us');
			return;
		}

		if (!selectedChoice) {
			return; // Nothing to submit
		}

		const surveyData: SurveyData = {
			choice: selectedChoice,
		};

		setIsSubmitting(true);

		try {
			await onSubmit?.(surveyData);
			// Reset form after successful submission
			setSelectedChoice(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to submit survey');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleChoiceChange = (choice: SurveyChoice) => {
		setSelectedChoice(choice);
		setError(null);
	};

	return (
		<div className={`bg-mineral-white rounded-lg ui-border p-8 shadow-md ${className}`}>
			<h2 className='text-4xl font-bold text-slate-500 mb-8'>How did you hear about us?</h2>

			<form
				onSubmit={handleSubmit}
				className='space-y-6'>
				<div className='space-y-6'>
					{surveyOptions.map((option) => (
						<label
							key={option.value}
							className='flex items-center gap-4 cursor-pointer text-3xl text-slate-700 hover:text-slate-900 transition-colors'>
							<input
								type='radio'
								name='hear-about-us'
								value={option.value}
								checked={selectedChoice === option.value}
								onChange={() => handleChoiceChange(option.value)}
								className='w-6 h-6 rounded-full border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-2'
								required={required}
							/>
							<span>{option.label}</span>
						</label>
					))}
				</div>

				{error && <div className='rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800'>{error}</div>}

				<button
					type='submit'
					disabled={isSubmitting || (required && !selectedChoice)}
					className='site-cta cta-primary mt-8 w-full px-10 py-4 text-xl'>
					{isSubmitting ? 'Submitting...' : 'Submit Form'}
				</button>
			</form>
		</div>
	);
}
