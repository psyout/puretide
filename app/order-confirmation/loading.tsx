import Header from '@/components/Header';

export default function OrderConfirmationLoading() {
	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<Header />
			<div className='max-w-7xl mx-auto px-6 py-16 pt-28'>
				<div className='max-w-4xl mx-auto bg-mineral-white backdrop-blur-sm rounded-lg ui-border shadow-lg p-6 animate-pulse'>
					<p className='text-deep-tidal-teal-600 text-sm mb-4' aria-live='polite'>
						Loading your order…
					</p>
					<div className='h-9 bg-deep-tidal-teal/15 rounded w-3/4 mb-3' />
					<div className='h-5 bg-deep-tidal-teal/10 rounded w-1/2 mb-8' />
					<div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-8'>
						{[1, 2, 3, 4].map((i) => (
							<div key={i} className='rounded-lg border border-deep-tidal-teal/10 p-4'>
								<div className='h-4 bg-deep-tidal-teal/10 rounded w-24 mb-3' />
								<div className='h-6 bg-deep-tidal-teal/20 rounded w-28' />
							</div>
						))}
					</div>
					<div className='grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8 border-t border-deep-tidal-teal/10'>
						<div className='lg:col-span-2 space-y-4'>
							<div className='h-6 bg-deep-tidal-teal/15 rounded w-40 mb-4' />
							<div className='h-12 bg-deep-tidal-teal/10 rounded' />
							<div className='h-12 bg-deep-tidal-teal/10 rounded' />
							<div className='h-12 bg-deep-tidal-teal/10 rounded' />
						</div>
						<div className='space-y-3'>
							<div className='h-6 bg-deep-tidal-teal/15 rounded w-32 mb-4' />
							<div className='h-20 bg-deep-tidal-teal/10 rounded' />
							<div className='h-20 bg-deep-tidal-teal/10 rounded' />
						</div>
					</div>
					<div className='h-12 bg-deep-tidal-teal/10 rounded w-48 mt-8' />
				</div>
			</div>
		</div>
	);
}
