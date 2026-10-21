'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const platforms = ['Instagram', 'TikTok', 'YouTube', 'X', 'Facebook', 'Podcast', 'Other'];

type FormState = {
	name: string;
	email: string;
	location: string;
	platforms: string[];
	handle: string;
	audienceSize: string;
	preferredCode: string;
	about: string;
	website: string;
	agreed: boolean;
};

const initialForm: FormState = { name: '', email: '', location: '', platforms: [], handle: '', audienceSize: '', preferredCode: '', about: '', website: '', agreed: false };

export default function AffiliateApplicationForm() {
	const [form, setForm] = useState<FormState>(initialForm);
	const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
	const [isSubmitting, setIsSubmitting] = useState(false);

	const togglePlatform = (platform: string) => {
		setForm((current) => ({ ...current, platforms: current.platforms.includes(platform) ? current.platforms.filter((item) => item !== platform) : [...current.platforms, platform] }));
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isSubmitting) return;
		if (!form.name.trim() || !form.email.trim() || !form.handle.trim() || !form.about.trim() || form.platforms.length === 0 || !form.agreed) {
			setStatus({ type: 'error', message: 'Please complete the required fields and accept the program guidelines.' });
			return;
		}

		setIsSubmitting(true);
		setStatus({ type: 'idle', message: '' });
		try {
			const response = await fetch('/api/affiliate-application', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
			const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
			if (!response.ok || !data?.ok) {
				setStatus({
					type: 'error',
					message:
						response.status === 429 ? 'Too many applications were submitted. Please try again later.' : (data?.error ?? 'We could not submit your application. Please try again.'),
				});
				return;
			}
			setForm(initialForm);
			setStatus({ type: 'success', message: 'Application received. Thanks for introducing yourself—we’ll review it and follow up by email.' });
		} catch {
			setStatus({ type: 'error', message: 'We could not submit your application right now. Please try again.' });
		} finally {
			setIsSubmitting(false);
		}
	};

	const fieldClass =
		'mt-2 w-full rounded-xl border border-deep-tidal-teal-800/15 bg-white px-4 py-3.5 text-deep-tidal-teal-800 outline-none transition placeholder:text-deep-tidal-teal-800/30 focus:border-deep-tidal-teal-500 focus:ring-4 focus:ring-deep-tidal-teal-500/10';

	if (status.type === 'success') {
		return (
			<div
				className='flex min-h-[32rem] flex-col items-center justify-center rounded-xl border border-[#d4eaf3] bg-[#eef6fa] p-8 text-center sm:p-12'
				role='status'>
				<div className='flex h-16 w-16 items-center justify-center rounded-full bg-eucalyptus-200 text-deep-tidal-teal-700'>
					<CheckCircle2
						className='h-8 w-8'
						aria-hidden='true'
					/>
				</div>
				<h3 className='mt-6 text-3xl font-semibold tracking-[-0.03em]'>Application received.</h3>
				<p className='mt-4 max-w-md text-deep-tidal-teal-700/65'>{status.message}</p>
				<button
					type='button'
					onClick={() => setStatus({ type: 'idle', message: '' })}
					className='mt-8 text-sm font-semibold text-deep-tidal-teal-700 underline decoration-eucalyptus-400 decoration-2 underline-offset-4'>
					Submit another application
				</button>
			</div>
		);
	}

	return (
		<form
			onSubmit={handleSubmit}
			className='rounded-xl border border-[#dde8ed] bg-[#f5f7f8] p-6 shadow-[0_4px_40px_rgba(28,72,85,0.08)] sm:p-9'
			noValidate>
			<div
				className='absolute -left-[9999px] h-1 w-1 overflow-hidden'
				aria-hidden='true'>
				<label htmlFor='affiliate-website'>Website</label>
				<input
					id='affiliate-website'
					tabIndex={-1}
					autoComplete='off'
					value={form.website}
					onChange={(event) => setForm({ ...form, website: event.target.value })}
				/>
			</div>
			<div className='grid gap-5 sm:grid-cols-2'>
				<label className='text-sm font-semibold'>
					Name <span className='text-eucalyptus-600'>*</span>
					<input
						className={fieldClass}
						value={form.name}
						onChange={(event) => setForm({ ...form, name: event.target.value })}
						maxLength={100}
						autoComplete='name'
						required
					/>
				</label>
				<label className='text-sm font-semibold'>
					Email <span className='text-eucalyptus-600'>*</span>
					<input
						type='email'
						className={fieldClass}
						value={form.email}
						onChange={(event) => setForm({ ...form, email: event.target.value })}
						maxLength={254}
						autoComplete='email'
						required
					/>
				</label>
				<label className='text-sm font-semibold sm:col-span-2'>
					City / region <span className='font-normal text-deep-tidal-teal-700/45'>(optional)</span>
					<input
						className={fieldClass}
						value={form.location}
						onChange={(event) => setForm({ ...form, location: event.target.value })}
						maxLength={120}
						autoComplete='address-level2'
						placeholder='Vancouver, BC'
					/>
				</label>
			</div>
			<fieldset className='mt-7'>
				<legend className='text-sm font-semibold'>
					Where do you create? <span className='text-eucalyptus-600'>*</span>
				</legend>
				<p className='mt-1 text-xs text-deep-tidal-teal-700/50'>Choose all that apply.</p>
				<div className='mt-3 flex flex-wrap gap-2'>
					{platforms.map((platform) => {
						const active = form.platforms.includes(platform);
						return (
							<button
								key={platform}
								type='button'
								aria-pressed={active}
								onClick={() => togglePlatform(platform)}
								className={`rounded-full border px-4 py-2 text-sm font-medium transition ${active ? 'border-deep-tidal-teal-700 bg-deep-tidal-teal-700 text-white' : 'border-deep-tidal-teal-800/15 bg-white text-deep-tidal-teal-700 hover:border-deep-tidal-teal-500/50'}`}>
								{platform}
							</button>
						);
					})}
				</div>
			</fieldset>
			<div className='mt-7 grid gap-5 sm:grid-cols-2'>
				<label className='text-sm font-semibold'>
					Main handle or channel <span className='text-eucalyptus-600'>*</span>
					<input
						className={fieldClass}
						value={form.handle}
						onChange={(event) => setForm({ ...form, handle: event.target.value })}
						maxLength={200}
						placeholder='@yourhandle or URL'
						required
					/>
				</label>
				<label className='text-sm font-semibold'>
					Audience size <span className='font-normal text-deep-tidal-teal-700/45'>(optional)</span>
					<select
						className={fieldClass}
						value={form.audienceSize}
						onChange={(event) => setForm({ ...form, audienceSize: event.target.value })}>
						<option value=''>Select a range</option>
						<option>Under 1,000</option>
						<option>1,000–10,000</option>
						<option>10,000–50,000</option>
						<option>50,000–100,000</option>
						<option>100,000+</option>
					</select>
				</label>
				<label className='text-sm font-semibold sm:col-span-2'>
					Preferred code <span className='font-normal text-deep-tidal-teal-700/45'>(optional)</span>
					<input
						className={`${fieldClass} uppercase`}
						value={form.preferredCode}
						onChange={(event) => setForm({ ...form, preferredCode: event.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
						maxLength={24}
						placeholder='YOURNAME'
					/>
				</label>
				<label className='text-sm font-semibold sm:col-span-2'>
					Why are you a good fit for Puretide? <span className='text-eucalyptus-600'>*</span>
					<textarea
						className={`${fieldClass} min-h-36 resize-y`}
						value={form.about}
						onChange={(event) => setForm({ ...form, about: event.target.value })}
						maxLength={1500}
						placeholder='Tell us about your content, your audience, and what you would like to create.'
						required
					/>
				</label>
			</div>
			<label className='mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-deep-tidal-teal-800/10 bg-white p-4 text-sm leading-6 text-deep-tidal-teal-700/75'>
				<input
					type='checkbox'
					className='mt-1 h-4 w-4 accent-deep-tidal-teal-700'
					checked={form.agreed}
					onChange={(event) => setForm({ ...form, agreed: event.target.checked })}
					required
				/>
				<span>
					I confirm that I am 19 or older and agree to follow Puretide’s research-use, disclosure, and responsible-content guidelines. <span className='text-eucalyptus-600'>*</span>
				</span>
			</label>
			{status.type === 'error' && (
				<p
					className='mt-5 rounded-xl bg-rose-100 px-4 py-3 text-sm text-rose-700'
					role='alert'>
					{status.message}
				</p>
			)}
			<button
				type='submit'
				disabled={isSubmitting}
				className='site-cta mt-6 w-full border border-deep-tidal-teal bg-deep-tidal-teal text-white hover:border-deep-tidal-teal-600 hover:bg-deep-tidal-teal-600 disabled:cursor-not-allowed disabled:opacity-60'>
				{isSubmitting ? 'Submitting…' : 'Submit application'}
				{!isSubmitting && (
					<ArrowRight
						className='h-4 w-4'
						aria-hidden='true'
					/>
				)}
			</button>
			<p className='mt-4 text-center text-xs text-deep-tidal-teal-700/45'>Your information is used only to review and respond to your application.</p>
		</form>
	);
}
