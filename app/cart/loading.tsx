import Header from '@/components/Header';

export default function CartLoading() {
	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<Header />
			<div className='max-w-7xl mx-auto px-6 py-24'>
				<div className='h-5 bg-deep-tidal-teal/15 rounded w-28 mb-8 animate-pulse' aria-hidden />
				<div className='h-10 bg-deep-tidal-teal/20 rounded w-48 mb-8 animate-pulse' aria-hidden />

				<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
					<div className='lg:col-span-2'>
						<div className='bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 shadow-lg animate-pulse'>
							{/* Cart item rows */}
							<div className='flex items-center gap-6 pb-6 mb-6 border-b border-deep-tidal-teal/10'>
								<div className='h-28 w-28 flex-shrink-0 rounded-lg bg-deep-tidal-teal/10' />
								<div className='flex-1 space-y-2'>
									<div className='h-6 bg-deep-tidal-teal/15 rounded w-3/4' />
									<div className='h-7 bg-deep-tidal-teal/10 rounded w-20' />
									<div className='h-4 bg-deep-tidal-teal/10 rounded w-full max-w-xs' />
									<div className='h-10 bg-deep-tidal-teal/10 rounded w-32 mt-3' />
								</div>
							</div>
							<div className='flex items-center gap-6'>
								<div className='h-28 w-28 flex-shrink-0 rounded-lg bg-deep-tidal-teal/10' />
								<div className='flex-1 space-y-2'>
									<div className='h-6 bg-deep-tidal-teal/15 rounded w-2/3' />
									<div className='h-7 bg-deep-tidal-teal/10 rounded w-24' />
									<div className='h-4 bg-deep-tidal-teal/10 rounded w-full max-w-sm' />
									<div className='h-10 bg-deep-tidal-teal/10 rounded w-32 mt-3' />
								</div>
							</div>
						</div>
					</div>
					<div className='lg:col-span-1'>
						<div className='bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 shadow-lg animate-pulse sticky top-24'>
							<div className='h-7 bg-deep-tidal-teal/15 rounded w-36 mb-6' />
							<div className='space-y-2 mb-6'>
								<div className='h-5 bg-deep-tidal-teal/10 rounded w-full' />
								<div className='h-5 bg-deep-tidal-teal/10 rounded w-4/5' />
								<div className='h-5 bg-deep-tidal-teal/10 rounded w-full' />
							</div>
							<div className='h-px bg-deep-tidal-teal/10 my-3' />
							<div className='space-y-2 mb-3'>
								<div className='h-4 bg-deep-tidal-teal/10 rounded w-24' />
								<div className='h-4 bg-deep-tidal-teal/10 rounded w-20' />
							</div>
							<div className='h-px bg-deep-tidal-teal/10 my-4' />
							<div className='h-6 bg-deep-tidal-teal/15 rounded w-24 mb-2' />
							<div className='h-8 bg-deep-tidal-teal/20 rounded w-32 mb-6' />
							<div className='h-12 bg-deep-tidal-teal/20 rounded w-full mb-3' />
							<div className='h-11 bg-deep-tidal-teal/10 rounded w-full' />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
