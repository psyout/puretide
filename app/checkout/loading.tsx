import Header from '@/components/Header';

export default function CheckoutLoading() {
	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<Header />
			<div className='max-w-7xl mx-auto px-6 py-24'>
				<div className='h-5 bg-deep-tidal-teal/15 rounded w-28 mb-8 animate-pulse' aria-hidden />
				<div className='h-10 bg-deep-tidal-teal/20 rounded w-48 mb-8 animate-pulse' aria-hidden />

				<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
					<div className='order-2 lg:order-1 lg:col-span-2'>
						<div className='bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 mb-6 shadow-lg animate-pulse'>
							<div className='h-8 bg-deep-tidal-teal/15 rounded w-40 mb-6' />
							<div className='space-y-4'>
								<div className='h-11 bg-deep-tidal-teal/10 rounded' />
								<div className='h-11 bg-deep-tidal-teal/10 rounded' />
								<div className='grid grid-cols-2 gap-4'>
									<div className='h-11 bg-deep-tidal-teal/10 rounded' />
									<div className='h-11 bg-deep-tidal-teal/10 rounded' />
								</div>
								<div className='h-11 bg-deep-tidal-teal/10 rounded' />
								<div className='h-11 bg-deep-tidal-teal/10 rounded' />
							</div>
						</div>
					</div>
					<div className='order-1 lg:order-2'>
						<div className='bg-mineral-white backdrop-blur-sm rounded-lg ui-border p-6 shadow-lg animate-pulse sticky top-28'>
							<div className='h-7 bg-deep-tidal-teal/15 rounded w-36 mb-6' />
							<div className='space-y-4 mb-6'>
								<div className='h-16 bg-deep-tidal-teal/10 rounded' />
								<div className='h-16 bg-deep-tidal-teal/10 rounded' />
							</div>
							<div className='h-px bg-deep-tidal-teal/10 my-4' />
							<div className='h-6 bg-deep-tidal-teal/15 rounded w-24 mb-2' />
							<div className='h-8 bg-deep-tidal-teal/20 rounded w-32 mb-6' />
							<div className='h-12 bg-deep-tidal-teal/20 rounded w-full' />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
