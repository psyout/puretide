'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	useEffect(() => {
		console.error('Global error:', error);
	}, [error]);

	return (
		<html lang='en'>
			<body className='m-0 font-sans bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50 min-h-screen'>
				<Header />
				<div className='min-h-[calc(100vh-80px)] flex items-center justify-center'>
					<div className='max-w-lg mx-6 bg-mineral-white backdrop-blur-sm rounded-lg ui-border shadow-lg p-8 text-center'>
						<h1 className='text-4xl font-bold mb-3 text-deep-tidal-teal-700'>Something went wrong</h1>
						<p className='text-deep-tidal-teal-800 mb-8'>We couldn&apos;t load this page. You can try again or return to the shop.</p>
						<div className='flex flex-col sm:flex-row gap-4 justify-center'>
							<button
								type='button'
								onClick={reset}
								className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors'>
								Try again
							</button>
							<Link
								href='/'
								className='border-2 border-deep-tidal-teal text-deep-tidal-teal hover:bg-deep-tidal-teal hover:text-mineral-white font-semibold py-3 px-6 rounded transition-colors inline-block'>
								Back to shop
							</Link>
						</div>
					</div>
				</div>
			</body>
		</html>
	);
}
