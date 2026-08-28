'use client';

import { useState } from 'react';

type ContactFormProps = {
	variant?: 'default' | 'editorial';
};

export default function ContactForm({ variant = 'default' }: ContactFormProps) {
	const [formData, setFormData] = useState({
		name: '',
		email: '',
		message: '',
		website: '', // honeypot: leave empty
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formStatus, setFormStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
		type: 'idle',
		message: '',
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (isSubmitting) {
			return;
		}

		const trimmedName = formData.name.trim();
		const trimmedEmail = formData.email.trim();
		const trimmedMessage = formData.message.trim();
		const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

		if (!trimmedName || !trimmedEmail || !trimmedMessage) {
			setFormStatus({ type: 'error', message: 'Please complete all fields before sending.' });
			return;
		}

		if (!emailPattern.test(trimmedEmail)) {
			setFormStatus({ type: 'error', message: 'Please enter a valid email address.' });
			return;
		}

		const MAX_NAME_LENGTH = 100;
		const MAX_MESSAGE_LENGTH = 2000;
		if (trimmedName.length > MAX_NAME_LENGTH) {
			setFormStatus({ type: 'error', message: 'Name is too long.' });
			return;
		}
		if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
			setFormStatus({ type: 'error', message: 'Message is too long.' });
			return;
		}

		setIsSubmitting(true);
		setFormStatus({ type: 'idle', message: '' });

		try {
			const response = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: trimmedName,
					email: trimmedEmail,
					message: trimmedMessage,
					website: formData.website,
				}),
			});

			let data: { ok?: boolean; error?: string } | null = null;
			try {
				data = (await response.json()) as { ok?: boolean; error?: string };
			} catch (parseError) {
				data = null;
			}

			if (!response.ok || data?.ok === false) {
				const message = response.status === 429 ? 'Too many requests. Please try again later.' : (data?.error ?? 'Something went wrong. Please try again.');
				setFormStatus({ type: 'error', message });
				return;
			}

			setFormStatus({ type: 'success', message: 'Thanks for reaching out. We will reply as soon as possible.' });
			setFormData({ name: '', email: '', message: '', website: '' });
		} catch (error) {
			setFormStatus({ type: 'error', message: 'Unable to send your message right now.' });
		} finally {
			setIsSubmitting(false);
		}
	};

	const isEditorial = variant === 'editorial';
	const fieldClassName = isEditorial
		? 'w-full rounded-xl border border-deep-tidal-teal-800/15 bg-white/80 px-4 py-3 text-deep-tidal-teal-800 outline-none transition focus:border-deep-tidal-teal focus:ring-4 focus:ring-deep-tidal-teal/10'
		: 'w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal';

	return (
		<div className={isEditorial ? 'p-7 sm:p-10 lg:p-12' : 'bg-mineral-white backdrop-blur-sm rounded-lg p-6 shadow-md ui-border'}>
			<div className={isEditorial ? 'mb-9' : 'mb-6'}>
				{isEditorial && <p className='mb-3 text-xs font-bold uppercase tracking-[0.2em] text-deep-tidal-teal-500'>Send a note</p>}
				<h3 className={isEditorial ? 'text-3xl font-bold tracking-[-0.03em] text-deep-tidal-teal-800 sm:text-4xl' : 'text-2xl font-bold text-deep-tidal-teal-800'}>
					{isEditorial ? 'How can we help?' : 'Send us a Message'}
				</h3>
				{isEditorial && <p className='mt-3 max-w-lg text-sm leading-relaxed text-deep-tidal-teal-700/70'>Tell us what you are curious about and our team will point you in the right direction.</p>}
			</div>
			<form
				onSubmit={handleSubmit}
				className={isEditorial ? 'space-y-5' : 'space-y-6'}>
				<div
					className='absolute -left-[9999px] w-1 h-1 overflow-hidden'
					aria-hidden>
					<label htmlFor='contact-website'>Website</label>
					<input
						type='text'
						id='contact-website'
						name='website'
						tabIndex={-1}
						autoComplete='off'
						value={formData.website}
						onChange={(e) => setFormData({ ...formData, website: e.target.value })}
					/>
				</div>
				<div>
					<label
						htmlFor='name'
						className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>
						Name
					</label>
					<input
						type='text'
						id='name'
						value={formData.name}
						onChange={(e) => setFormData({ ...formData, name: e.target.value })}
						className={fieldClassName}
						maxLength={100}
						required
					/>
				</div>
				<div>
					<label
						htmlFor='email'
						className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>
						Email
					</label>
					<input
						type='email'
						id='email'
						value={formData.email}
						onChange={(e) => setFormData({ ...formData, email: e.target.value })}
						className={fieldClassName}
						required
					/>
				</div>
				<div>
					<label
						htmlFor='message'
						className='block text-md font-medium mb-2 text-deep-tidal-teal-800'>
						Message
					</label>
					<textarea
						id='message'
						value={formData.message}
						onChange={(e) => setFormData({ ...formData, message: e.target.value })}
						rows={6}
						className={`${fieldClassName} resize-none`}
						maxLength={2000}
						required
					/>
				</div>
				{formStatus.type !== 'idle' && (
					<div className={`rounded-lg px-4 py-3 text-sm ${formStatus.type === 'success' ? 'bg-eucalyptus-200/70 text-deep-tidal-teal-800' : 'bg-rose-100 text-rose-700'}`}>
						{formStatus.message}
					</div>
				)}
				<button
					type='submit'
					disabled={isSubmitting}
					className={isEditorial
						? 'flex min-h-14 w-full items-center justify-center rounded-2xl bg-deep-tidal-teal-800 px-6 py-3 font-semibold text-mineral-white shadow-[0_18px_40px_-24px_rgba(10,32,39,0.8)] transition-colors hover:bg-deep-tidal-teal-700 disabled:cursor-not-allowed disabled:opacity-70'
						: 'w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors disabled:opacity-70 disabled:cursor-not-allowed'}>
					{isSubmitting ? 'Sending...' : 'Send Message'}
				</button>
			</form>
		</div>
	);
}
