import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';

export const metadata: Metadata = {
	title: 'FAQ | Pure Tide',
	description: 'Frequently asked questions about Pure Tide products, ordering, testing, and shipping.',
};

export default function FAQPage() {
	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<Header />
			<main className='mx-auto flex min-h-[70vh] max-w-4xl items-center px-6 pb-24 pt-32'>
				<div className='w-full rounded-2xl border border-deep-tidal-teal/10 bg-white/80 px-6 py-14 text-center shadow-sm sm:px-12'>
					<p className='text-xs font-bold uppercase tracking-[0.22em] text-eucalyptus-600'>Coming soon</p>
					<h1 className='mt-4 text-4xl font-bold text-deep-tidal-teal-900'>Frequently Asked Questions</h1>
					<p className='mx-auto mt-4 max-w-xl text-deep-tidal-teal-600'>We’re organizing clear answers about products, testing, ordering, shipping, and support.</p>
					<Link href='/' className='site-cta mt-8 bg-deep-tidal-teal text-white hover:bg-deep-tidal-teal-600'>Back to shop</Link>
				</div>
			</main>
		</div>
	);
}
