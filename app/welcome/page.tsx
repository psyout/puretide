import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
	title: 'Welcome to Pure Tide',
	description: 'A calm, considered approach to everyday wellness.',
};

const values = [
	{ label: 'Clear', detail: 'Straightforward information and an experience designed without noise.' },
	{ label: 'Considered', detail: 'Every detail is approached with care, intention, and transparency.' },
	{ label: 'Canadian', detail: 'Proudly based in Canada and built for our community.' },
];

export default function WelcomePage() {
	return (
		<main className='min-h-screen bg-[#082f36] text-white'>
			<section className='relative isolate flex min-h-[100svh] overflow-hidden'>
				<div className='absolute inset-0 -z-20 bg-[radial-gradient(circle_at_75%_28%,rgba(105,190,215,0.34),transparent_30%),radial-gradient(circle_at_18%_78%,rgba(142,177,163,0.18),transparent_34%),linear-gradient(135deg,#06282f_0%,#0b4551_52%,#092c39_100%)]' />
				<svg
					className='absolute inset-x-0 bottom-0 -z-10 h-[48%] w-full opacity-25'
					viewBox='0 0 1440 430'
					preserveAspectRatio='none'
					aria-hidden='true'>
					<path
						d='M-30 180C190 92 330 275 542 183c214-93 344-7 512 51 160 55 272-12 430-82v278H-30Z'
						fill='rgba(126, 202, 226, 0.22)'
					/>
					<path
						d='M-30 225c208-70 365 79 552 4 197-78 366 52 525 65 181 15 278-78 437-128'
						fill='none'
						stroke='rgba(240,240,240,0.45)'
						strokeWidth='2'
					/>
					<path
						d='M-30 267c226-55 369 76 570 3 171-62 323 53 503 68 182 16 313-51 441-109'
						fill='none'
						stroke='rgba(240,240,240,0.24)'
						strokeWidth='1'
					/>
				</svg>

				<div className='mx-auto flex w-full max-w-6xl flex-col px-6 py-8 sm:px-8 sm:py-10 lg:px-6'>
					<header className='flex items-center justify-between'>
						<Image
							src='/mineral-white-logo-simple.svg'
							alt='Pure Tide'
							width={1146}
							height={181}
							priority
							className='h-auto w-40 sm:w-48'
						/>
						<span className='hidden text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55 sm:block'>Proudly Canadian</span>
					</header>

					<div className='flex flex-1 items-center py-16 sm:py-20'>
						<div className='max-w-3xl'>
							<p className='mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#8ed0e5] sm:text-sm'>
								<span className='h-px w-8 bg-[#8ed0e5]/70' />
								Welcome
							</p>
							<h1 className='max-w-3xl text-[clamp(3rem,7vw,6.5rem)] font-bold uppercase leading-[0.9] tracking-[-0.045em] text-white'>Early Black Friday</h1>
							<p className='mt-6 text-[clamp(2rem,4.5vw,4rem)] font-bold uppercase leading-none tracking-[-0.025em] text-[#78c9e7]'>25% off sitewide</p>
							<p className='mt-7 max-w-xl text-base leading-relaxed text-white/75 sm:text-xl text-pretty'>
								Pure Tide is a Canadian wellness destination shaped around clarity, thoughtful choices, and a more considered online experience.
							</p>
							<Link
								href='/'
								className='group mt-9 inline-flex min-h-14 items-center justify-center rounded-sm bg-[#f0f0f0] px-9 text-sm font-bold uppercase tracking-[0.16em] text-[#082f36] transition-colors duration-200 hover:bg-[#8ed0e5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white'>
								Continue to Pure Tide
								<ArrowRight
									className='ml-3 h-5 w-5 transition-transform duration-300 motion-safe:group-hover:translate-x-1.5 motion-safe:group-focus-visible:translate-x-1.5'
									strokeWidth={2}
									aria-hidden='true'
								/>
							</Link>
						</div>
					</div>

					<div className='grid border-t border-white/15 sm:grid-cols-3 hidden'>
						{values.map((value, index) => (
							<div
								key={value.label}
								className={`py-5 sm:px-6 sm:py-6 ${index > 0 ? 'border-t border-white/15 sm:border-l sm:border-t-0' : ''} ${index === 0 ? 'sm:pl-0' : ''}`}>
								<p className='text-xs text-pretty font-bold uppercase tracking-[0.22em] text-[#8ed0e5]'>{value.label}</p>
								<p className='mt-2 max-w-xs text-sm text-pretty leading-relaxed text-white/55'>{value.detail}</p>
							</div>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
