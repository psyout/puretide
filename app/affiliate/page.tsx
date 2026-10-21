import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDown, BadgeCheck, BarChart3, FlaskConical, Megaphone, Sparkles } from 'lucide-react';
import Header from '@/components/Header';
import AffiliateApplicationForm from '@/components/AffiliateApplicationForm';

export const metadata: Metadata = {
	title: 'Affiliate Program | Puretide',
	description: 'Apply to become a Puretide affiliate and earn commission by sharing high-quality research products with your audience.',
};

const steps = [
	{ number: '01', title: 'Tell us about your work', body: 'Share where you create, who you reach, and why Puretide feels like a fit. Applications are reviewed by a real person.' },
	{ number: '02', title: 'Receive your partner code', body: 'If approved, we will confirm your commission terms and give you a unique discount code to share with your audience.' },
	{ number: '03', title: 'Create with confidence', body: 'Introduce Puretide in your own voice while following our research-use and responsible-content guidelines.' },
	{ number: '04', title: 'Earn on eligible orders', body: 'When a paid order uses your code, the sale is attributed to you and commission is calculated from the eligible merchandise total.' },
];

const principles = [
	'Your audience must be 19 or older.',
	'Puretide products must be presented strictly for laboratory research use.',
	'No dosing guidance, personal-use claims, or medical promises.',
	'Be clear about your affiliate relationship whenever you share your code.',
];

export default function AffiliatePage() {
	return (
		<div className='min-h-screen overflow-hidden bg-[#efefef] font-outfit text-[#1C4855]'>
			<Header />
			<main>
				<section className='relative isolate overflow-hidden bg-[#1C4855] px-6 pb-[88px] pt-[112px] text-white lg:px-8'>
					<div className='pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_22%,rgba(168,213,186,0.18),transparent_32%),radial-gradient(circle_at_12%_88%,rgba(77,167,182,0.18),transparent_38%)]' />
					<div className='pointer-events-none absolute -right-28 top-24 -z-10 h-80 w-80 rounded-full border border-white/10 sm:h-[32rem] sm:w-[32rem]' />
					<div className='mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16'>
						<div>
							<div className='fade-up inline-flex items-center gap-2 rounded-full border border-eucalyptus-300/30 bg-eucalyptus-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-eucalyptus-200'>
								<Sparkles
									className='h-4 w-4'
									aria-hidden='true'
								/>{' '}
								Puretide affiliate program
							</div>
							<h1 className='fade-up d1 mt-7 max-w-4xl text-balance text-[clamp(34px,5.5vw,58px)] font-bold leading-[1.1] tracking-[-0.02em]'>
								Share better standards. <span className='text-eucalyptus-300'>Earn as you grow.</span>
							</h1>
							<p className='fade-up d2 mt-6 max-w-2xl text-[17px] font-light leading-[1.65] tracking-[0.01em] text-white/65'>
								Turn thoughtful, responsible content into a long-term partnership. You bring the audience and the perspective; we provide a unique code and commission on
								eligible paid orders.
							</p>
							<div className='fade-up d3 mt-10 flex flex-col gap-4 sm:flex-row sm:items-center'>
								<Link
									href='#apply'
									className='site-cta border border-deep-tidal-teal-300 bg-deep-tidal-teal-400 text-white hover:border-deep-tidal-teal-200 hover:bg-deep-tidal-teal sm:min-w-[11.5rem]'>
									Apply to partner{' '}
									<ArrowDown
										className='h-4 w-4'
										aria-hidden='true'
									/>
								</Link>
								<Link
									href='#how-it-works'
									className='site-cta border border-white/20 bg-transparent text-white hover:border-white/40 hover:bg-white/5 sm:min-w-[11.5rem]'>
									See how it works
								</Link>
							</div>
							<p className='fade-up d4 mt-5 text-sm text-white/45'>Human-reviewed · Flexible content formats · Terms confirmed before launch</p>
						</div>
						<div className='relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end'>
							<div className='absolute -inset-8 rounded-[3rem] bg-eucalyptus-300/10 blur-2xl' />
							<div className='relative rotate-[2deg] rounded-[2rem] border border-white/15 bg-white/[0.08] p-3 shadow-2xl backdrop-blur-md'>
								<div className='rounded-[1.55rem] bg-[#f2f5ef] p-7 text-deep-tidal-teal-800 sm:p-9'>
									<div className='flex items-center justify-between'>
										<span className='text-xs font-bold uppercase tracking-[0.18em] text-deep-tidal-teal-500'>Your partner code</span>
										<BadgeCheck
											className='h-6 w-6 text-eucalyptus-600'
											aria-hidden='true'
										/>
									</div>
									<div className='mt-10 rounded-2xl border border-dashed border-deep-tidal-teal-800/25 bg-white/70 px-5 py-6 text-center'>
										<p className='text-2xl font-semibold tracking-[0.14em]'>YOURCODE</p>
										<p className='mt-2 text-sm text-deep-tidal-teal-600/70'>A code your community can remember</p>
									</div>
									<div className='mt-8 grid grid-cols-2 gap-3'>
										<div className='rounded-2xl bg-deep-tidal-teal-800 p-4 text-white'>
											<BarChart3
												className='h-5 w-5 text-eucalyptus-300'
												aria-hidden='true'
											/>
											<p className='mt-5 text-sm font-semibold'>Tracked orders</p>
											<p className='mt-1 text-xs text-white/55'>Every eligible sale counts</p>
										</div>
										<div className='rounded-2xl bg-eucalyptus-200/65 p-4'>
											<Megaphone
												className='h-5 w-5 text-deep-tidal-teal-700'
												aria-hidden='true'
											/>
											<p className='mt-5 text-sm font-semibold'>Your voice</p>
											<p className='mt-1 text-xs text-deep-tidal-teal-700/65'>Create in your own style</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				<section
					id='how-it-works'
					className='scroll-mt-24 bg-[#efefef] px-6 py-[88px] lg:px-8'>
					<div className='mx-auto max-w-7xl'>
						<div className='max-w-[620px]'>
							<p className='text-[11px] font-bold uppercase tracking-[0.26em] text-[#6EB4CC]'>From application to commission</p>
							<h2 className='mt-4 text-balance text-[clamp(32px,5vw,52px)] font-bold leading-[1.1] tracking-[-0.02em]'>A simple partnership, built to last.</h2>
							<p className='mt-5 text-[16px] leading-[1.75] text-[#3a6070]'>
								No complicated onboarding. We agree on the terms, set up your code, and let great content do the rest.
							</p>
						</div>
						<div className='mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
							{steps.map((step) => (
								<article
									key={step.number}
									className='min-h-72 rounded-xl border border-[#dde8ed] bg-white p-7 transition-all hover:border-[#d4eaf3] hover:shadow-[0_4px_24px_rgba(110,180,204,0.12)]'>
									<p className='text-sm font-semibold text-[#6EB4CC]'>{step.number}</p>
									<h3 className='mt-12 text-xl font-bold tracking-[-0.02em]'>{step.title}</h3>
									<p className='mt-4 text-[14px] leading-[1.75] text-[#3a6070]'>{step.body}</p>
								</article>
							))}
						</div>
					</div>
				</section>

				<section className='bg-[#efefef] px-6 pb-[88px] lg:px-8'>
					<div className='mx-auto grid max-w-7xl overflow-hidden rounded-xl bg-[#e5eee7] lg:grid-cols-[0.82fr_1.18fr]'>
						<div className='flex flex-col justify-between bg-deep-tidal-teal-700 p-8 text-white sm:p-12'>
							<div>
								<FlaskConical
									className='h-9 w-9 text-eucalyptus-300'
									aria-hidden='true'
								/>
								<p className='mt-10 text-xs font-bold uppercase tracking-[0.22em] text-eucalyptus-300'>Responsible by design</p>
								<h2 className='mt-4 text-4xl font-semibold tracking-[-0.035em]'>Clear standards protect everyone.</h2>
							</div>
							<p className='mt-12 text-sm leading-6 text-white/55'>Approved partners receive the full content guidelines before sharing their code.</p>
						</div>
						<div className='p-8 sm:p-12 lg:p-14'>
							<p className='max-w-2xl text-lg leading-8 text-deep-tidal-teal-700/70'>
								We want partners who care about accuracy as much as reach. These essentials are part of every Puretide partnership:
							</p>
							<ul className='mt-9 grid gap-4 sm:grid-cols-2'>
								{principles.map((principle) => (
									<li
										key={principle}
										className='flex gap-3 rounded-2xl bg-white/70 p-5 text-sm leading-6'>
										<BadgeCheck
											className='mt-0.5 h-5 w-5 shrink-0 text-eucalyptus-600'
											aria-hidden='true'
										/>
										{principle}
									</li>
								))}
							</ul>
						</div>
					</div>
				</section>

				<section
					id='apply'
					className='scroll-mt-20 bg-white px-6 py-[88px] lg:px-8'>
					<div className='mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16'>
						<div className='lg:sticky lg:top-32 lg:self-start'>
							<p className='text-[11px] font-bold uppercase tracking-[0.26em] text-[#6EB4CC]'>Become a partner</p>
							<h2 className='mt-4 text-balance text-[clamp(32px,5vw,52px)] font-bold leading-[1.1] tracking-[-0.02em]'>Let’s build something worthwhile.</h2>
							<p className='mt-6 text-[16px] leading-[1.75] text-[#3a6070]'>
								You do not need a massive following. We look for trust, consistency, and a genuine fit with the Puretide standard.
							</p>
							<div className='mt-9 border-l-2 border-[#6EB4CC] pl-5'>
								<p className='font-semibold'>What happens next?</p>
								<p className='mt-2 text-md leading-6 text-[#3a6070]'>
									We review your application and contact you by email if there is a fit. Your specific discount, commission, and payout terms will be confirmed before you
									begin.
								</p>
							</div>
						</div>
						<AffiliateApplicationForm />
					</div>
				</section>
			</main>
		</div>
	);
}
