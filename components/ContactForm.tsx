'use client';

import { useState } from 'react';

export default function ContactForm() {
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
				setFormStatus({
					type: 'error',
					message: data?.error ?? 'Something went wrong. Please try again.',
				});
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

	return (
		<div className='bg-muted-sage/20 backdrop-blur-md rounded-xl p-6 shadow-sm ui-border'>
			<h3 className='text-2xl font-bold text-deep-tidal-teal-800 mb-6'>Send us a Message</h3>
			<form
				onSubmit={handleSubmit}
				className='space-y-6'>
				<div className='absolute -left-[9999px] w-1 h-1 overflow-hidden' aria-hidden>
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
						className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
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
						className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
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
						className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal resize-none'
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
					className='w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors disabled:opacity-70 disabled:cursor-not-allowed'>
					{isSubmitting ? 'Sending...' : 'Send Message'}
				</button>
			</form>
		</div>
	);
}
