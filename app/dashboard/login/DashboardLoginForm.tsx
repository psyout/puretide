'use client';

import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';

interface DashboardLoginFormProps {
	auth0Configured: boolean;
}

function GoogleIcon() {
	return (
		<svg viewBox='0 0 24 24' className='h-5 w-5' aria-hidden='true'>
			<path fill='#4285F4' d='M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z' />
			<path fill='#34A853' d='M12 22c2.7 0 4.97-.9 6.62-2.38l-3.24-2.53c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z' />
			<path fill='#FBBC05' d='M6.39 13.92A6.02 6.02 0 0 1 6.07 12c0-.67.11-1.32.32-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.53l3.35-2.61Z' />
			<path fill='#EA4335' d='M12 5.95c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z' />
		</svg>
	);
}

export default function DashboardLoginForm({ auth0Configured }: DashboardLoginFormProps) {
	const searchParams = useSearchParams();
	const auth0Unavailable = searchParams.get('auth0') === 'unavailable';
	const signInUnavailable = !auth0Configured || auth0Unavailable;

	return (
		<main className='min-h-screen bg-[#edf1ef] text-[#1f1f1f]'>
			<div className='grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]'>
				<section className='relative hidden overflow-hidden bg-deep-tidal-teal px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-14'>
					<div className='absolute -left-32 -top-32 h-96 w-96 rounded-full border border-white/10' />
					<div className='absolute -left-16 -top-16 h-64 w-64 rounded-full border border-white/10' />
					<div className='absolute -bottom-48 -right-32 h-[34rem] w-[34rem] rounded-full bg-white/[0.04]' />

					<div className='relative flex items-center gap-3'>
						<div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-white font-bold text-deep-tidal-teal shadow-lg shadow-black/10'>P</div>
						<div>
							<p className='font-semibold tracking-tight'>Puretide</p>
							<p className='text-xs text-white/65'>Operations dashboard</p>
						</div>
					</div>

					<div className='relative max-w-xl'>
						<span className='mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85'>
							<ShieldCheck className='h-4 w-4' aria-hidden='true' />
							Private team workspace
						</span>
						<h1 className='max-w-lg text-4xl font-semibold leading-[1.08] tracking-[-0.035em] xl:text-5xl'>Your store operations, all in one place.</h1>
						<p className='mt-5 max-w-lg text-base leading-7 text-white/70'>Manage customers, inventory, orders, discounts, and fulfillment from a secure internal workspace.</p>
					</div>

					<p className='relative text-xs text-white/50'>Authorized Puretide team members only</p>
				</section>

				<section className='flex min-h-screen items-center justify-center px-5 py-10 sm:px-10'>
					<div className='w-full max-w-md'>
						<a href='/' className='mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#6a6a6a] transition-colors hover:text-deep-tidal-teal'>
							<ArrowLeft className='h-4 w-4' aria-hidden='true' />
							Return to store
						</a>

						<div className='rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_24px_70px_rgba(22,70,75,0.10)] sm:p-9'>
							<div className='mb-8 flex items-center gap-3 lg:hidden'>
								<div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-deep-tidal-teal font-bold text-white'>P</div>
								<div>
									<p className='font-semibold text-[#1f1f1f]'>Puretide</p>
									<p className='text-xs text-[#7a7a7a]'>Operations dashboard</p>
								</div>
							</div>

							<div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-eucalyptus-100 text-deep-tidal-teal'>
								<LockKeyhole className='h-5 w-5' aria-hidden='true' />
							</div>
							<h2 className='mt-5 text-3xl font-semibold tracking-[-0.025em] text-[#1f1f1f]'>Welcome back</h2>
							<p className='mt-2 text-sm leading-6 text-[#6f6f6f]'>Sign in with your approved Puretide Google account to continue to the dashboard.</p>

							{signInUnavailable ? (
								<div className='mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-4'>
									<p className='text-sm font-semibold text-amber-900'>Sign-in is temporarily unavailable</p>
									<p className='mt-1 text-sm leading-5 text-amber-800'>Please contact the site administrator or try again shortly.</p>
								</div>
							) : (
								<a
									href='/auth/login?returnTo=/dashboard'
									className='group mt-7 flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-sm font-semibold text-[#2f2f2f] shadow-sm transition-all hover:-translate-y-0.5 hover:border-deep-tidal-teal/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/25'>
									<span className='flex items-center gap-3'>
										<span className='flex h-9 w-9 items-center justify-center rounded-xl bg-[#f7f7f7]'><GoogleIcon /></span>
										Continue with Google
									</span>
									<ArrowRight className='h-4 w-4 text-[#8a8a8a] transition-transform group-hover:translate-x-0.5 group-hover:text-deep-tidal-teal' aria-hidden='true' />
								</a>
							)}

							<div className='mt-6 flex items-start gap-2.5 rounded-xl bg-[#f7f8f8] px-3.5 py-3 text-xs leading-5 text-[#747474]'>
								<ShieldCheck className='mt-0.5 h-4 w-4 shrink-0 text-deep-tidal-teal' aria-hidden='true' />
								<span>Access is restricted to approved team email addresses. Authentication is securely handled by Auth0.</span>
							</div>
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}
