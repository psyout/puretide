'use client';

import { useState } from 'react';

export default function Contact() {
	const [formData, setFormData] = useState({
		name: '',
		email: '',
		message: '',
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		// Handle form submission (in real app, this would send to an API)
		alert('Thank you for your message! We will get back to you soon.');
		setFormData({ name: '', email: '', message: '' });
	};

	return (
		<section className='py-20 px-4'>
			<div className='container mx-auto max-w-6xl'>
				<div className='text-center mb-12'>
					<h2 className='text-4xl font-bold text-deep-tidal-teal-800 mb-4'>Get in Touch</h2>
					<p className='text-deep-tidal-teal-700 text-lg max-w-2xl mx-auto'>
						Have questions about our products? We are here to help. Reach out to us and we will respond as soon as possible.
					</p>
				</div>

				<div className='grid grid-cols-1 lg:grid-cols-2 gap-12'>
					{/* Contact Form */}
					<div className='bg-eucalyptus-100/60 backdrop-blur-sm rounded-lg p-8 shadow-lg border border-black/10'>
						<h3 className='text-2xl font-bold text-deep-tidal-teal-800 mb-6'>Send us a Message</h3>
						<form
							onSubmit={handleSubmit}
							className='space-y-6'>
							<div>
								<label
									htmlFor='name'
									className='block text-sm font-medium text-deep-tidal-teal-800 mb-2'>
									Name
								</label>
								<input
									type='text'
									id='name'
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
									className='w-full bg-mineral-white rounded px-4 py-3 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
									required
								/>
							</div>
							<div>
								<label
									htmlFor='email'
									className='block text-sm font-medium text-deep-tidal-teal-800 mb-2'>
									Email
								</label>
								<input
									type='email'
									id='email'
									value={formData.email}
									onChange={(e) => setFormData({ ...formData, email: e.target.value })}
									className='w-full bg-mineral-white rounded px-4 py-3 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
									required
								/>
							</div>
							<div>
								<label
									htmlFor='message'
									className='block text-sm font-medium text-deep-tidal-teal-800 mb-2'>
									Message
								</label>
								<textarea
									id='message'
									value={formData.message}
									onChange={(e) => setFormData({ ...formData, message: e.target.value })}
									rows={6}
									className='w-full bg-mineral-white rounded px-4 py-3 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal resize-none'
									required
								/>
							</div>
							<button
								type='submit'
								className='w-full bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors'>
								Send Message
							</button>
						</form>
					</div>

					{/* Contact Information */}
					<div className='space-y-8'>
						<div className='bg-eucalyptus-100/60 backdrop-blur-sm rounded-lg p-8 shadow-lg border border-black/10'>
							<h3 className='text-2xl font-bold text-deep-tidal-teal-800 mb-6'>Contact Information</h3>
							<div className='space-y-6'>
								<div className='flex items-start gap-4'>
									<div className='mt-1'>
										<svg
											className='w-6 h-6 text-deep-tidal-teal'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={1.5}
												d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
											/>
										</svg>
									</div>
									<div>
										<h4 className='font-semibold text-deep-tidal-teal-800 mb-1'>Email</h4>
										<p className='text-deep-tidal-teal-700'>info@pure-tide.com</p>
									</div>
								</div>
								<div className='flex items-start gap-4'>
									<div className='mt-1'>
										<svg
											className='w-6 h-6 text-deep-tidal-teal'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={1.5}
												d='M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z'
											/>
										</svg>
									</div>
									<div>
										<h4 className='font-semibold text-deep-tidal-teal-800 mb-1'>Phone</h4>
										<p className='text-deep-tidal-teal-700'>+1 (555) 123-4567</p>
									</div>
								</div>
							</div>
						</div>

						{/* Additional Info */}
						<div className='bg-eucalyptus-100/60 border border-black/10 backdrop-blur-sm rounded-lg p-6 shadow-md'>
							<div className='flex items-center gap-2 mb-3'>
								<svg
									className='w-5 h-5 text-deep-tidal-teal'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={1.5}
										d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
									/>
								</svg>
								<h4 className='font-semibold text-deep-tidal-teal-800'>Privacy First</h4>
							</div>
							<p className='text-sm text-deep-tidal-teal-700'>
								Your contact information is kept confidential and will never be shared with third parties. We respect your privacy and handle all communications securely.
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
