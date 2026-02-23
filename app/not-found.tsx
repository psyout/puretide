import Link from 'next/link';
import Header from '@/components/Header';

export default function NotFound() {
	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<Header />
			<div className='max-w-7xl mx-auto px-6 py-24 pt-28'>
				<div className='max-w-2xl mx-auto text-center'>
					<h1 className='text-4xl font-bold mb-3 text-deep-tidal-teal-700'>Page not found</h1>
					<p className='text-deep-tidal-teal-800 mb-8'>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
					<Link
						href='/'
						className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors inline-block'>
						Back to shop
					</Link>
				</div>
			</div>
		</div>
	);
}
