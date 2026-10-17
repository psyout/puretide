import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';

export const metadata: Metadata = {
	title: 'Affiliate Program | Pure Tide',
	description: 'Learn about the upcoming Pure Tide affiliate program.',
};

export default function AffiliatePage() {
	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<Header />
			<main className='mx-auto flex min-h-[70vh] max-w-4xl items-center px-6 pb-24 pt-32'>
				<div className='w-full rounded-2xl border border-deep-tidal-teal/10 bg-white/80 px-6 py-14 text-center shadow-sm sm:px-12'>
					<p className='text-xs font-bold uppercase tracking-[0.22em] text-eucalyptus-600'>Coming soon</p>
					<h1 className='mt-4 text-4xl font-bold text-deep-tidal-teal-900'>Pure Tide Affiliate Program</h1>
					<p className='mx-auto mt-4 max-w-xl text-deep-tidal-teal-600'>We’re preparing the program details, eligibility information, and application experience.</p>
					<Link href='/' className='mt-8 inline-flex rounded-lg bg-deep-tidal-teal px-6 py-3 font-semibold text-white transition hover:bg-deep-tidal-teal-600'>Back to shop</Link>
				</div>
			</main>
		</div>
	);
}
