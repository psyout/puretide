import { ArrowUpRight, Clock3, LockKeyhole, Mail } from 'lucide-react';
import ContactForm from './ContactForm';

const details = [
	{
		icon: Mail,
		label: 'Email us directly',
		value: 'info@puretide.ca',
	},
	{
		icon: Clock3,
		label: 'Typical response',
		value: 'Within 1–2 business days',
	},
];

export default function ContactAlternative() {
	return (
		<section
			id='contact'
			aria-labelledby='contact-alternative-title'
			className='relative isolate scroll-mt-32 overflow-hidden bg-[#edf4f6] py-20 sm:py-24 lg:py-32'>
			<div className='relative mx-auto max-w-7xl px-6'>
				<div className='grid  border-deep-tidal-teal-800/15 lg:grid-cols-[0.78fr_1.22fr]'>
					<div className='py-10 text-deep-tidal-teal-800 sm:py-12 lg:border-r lg:border-deep-tidal-teal-800/15 lg:py-14 lg:pr-12'>
						<div className='flex h-full min-h-[30rem] flex-col'>
							<div>
								<p className='text-xs font-bold uppercase tracking-[0.22em] text-deep-tidal-teal-600'>A real conversation</p>
								<h3 className='mt-4 max-w-sm text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl'>Clear answers, handled with care.</h3>
								<p className='mt-5 max-w-sm leading-relaxed text-deep-tidal-teal-700/65'>Every message is read by our team—not routed through a generic support loop.</p>
							</div>

							<div className='mt-12 space-y-7 lg:mt-auto'>
								{details.map((detail) => {
									const Icon = detail.icon;
									return (
										<div
											key={detail.label}
											className='flex items-start gap-4 border-t border-deep-tidal-teal-800/15 pt-6'>
											<span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/55 text-deep-tidal-teal-700'>
												<Icon
													className='h-4 w-4'
													strokeWidth={1.8}
												/>
											</span>
											<div>
												<p className='text-xs font-semibold uppercase tracking-[0.14em] text-deep-tidal-teal-600/65'>{detail.label}</p>
												{detail.label === 'Email us directly' ? (
													<a
														href='mailto:info@puretide.ca'
														className='mt-1 inline-flex items-center gap-2 font-semibold text-deep-tidal-teal-800 transition-colors hover:text-deep-tidal-teal'>
														{detail.value}
														<ArrowUpRight className='h-4 w-4' />
													</a>
												) : (
													<p className='mt-1 font-semibold text-deep-tidal-teal-800'>{detail.value}</p>
												)}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					</div>

					<ContactForm variant='editorial' />
				</div>

				<div className='mt-6 flex items-start gap-3 px-2 text-sm leading-relaxed text-deep-tidal-teal-700/65'>
					<LockKeyhole
						className='mt-0.5 h-4 w-4 shrink-0 text-deep-tidal-teal-600'
						strokeWidth={1.8}
					/>
					<p>Your contact details stay confidential and are used only to respond to your message.</p>
				</div>
			</div>
		</section>
	);
}
