import ContactForm from './ContactForm';

export default function Contact() {
	return (
		<section className='py-32 px-6 sm:px-8 bg-white'>
			<div className='mx-auto max-w-7xl px-6'>
				<div className='text-center mb-12'>
					<h2 className='text-4xl font-bold text-deep-tidal-teal-800 mb-4'>Get in Touch</h2>
					<p className='text-deep-tidal-teal-700 text-lg max-w-2xl mx-auto'>
						Have questions about our products? We are here to help. Reach out to us and we will respond as soon as possible.
					</p>
				</div>

				<div className='grid grid-cols-1 lg:grid-cols-2 gap-12'>
					{/* Contact Form */}
					<ContactForm />

					{/* Contact Information */}
					<div className='space-y-8'>
						<div className='bg-muted-sage/20 backdrop-blur-sm rounded-lg p-6 shadow-lg ui-border'>
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
										<a
											href='mailto:info@puretide.ca'
											className='text-deep-tidal-teal-700 hover:text-deep-tidal-teal'>
											info@puretide.ca
										</a>
									</div>
								</div>
							</div>
						</div>

						{/* Additional Info */}
						<div className='bg-muted-sage/20 backdrop-blur-sm rounded-lg p-6 shadow-md ui-border'>
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
