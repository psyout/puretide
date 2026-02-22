import Header from '@/components/Header';

export default function OrderConfirmationLoading() {
	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<Header />
			<div className='max-w-7xl mx-auto px-6 py-16 pt-28'>
				<div className='max-w-4xl mx-auto bg-muted-sage/30 backdrop-blur-sm rounded-lg ui-border shadow-lg p-6 animate-pulse'>
					<div className='h-8 bg-deep-tidal-teal/20 rounded w-3/4 mb-4' />
					<div className='h-4 bg-deep-tidal-teal/10 rounded w-1/2 mb-8' />
					<div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-8'>
						{[1, 2, 3, 4].map((i) => (
							<div key={i} className='bg-mineral-white rounded-lg ui-border p-4'>
								<div className='h-4 bg-deep-tidal-teal/10 rounded w-20 mb-3' />
								<div className='h-6 bg-deep-tidal-teal/20 rounded w-24' />
							</div>
						))}
					</div>
					<div className='h-32 bg-deep-tidal-teal/10 rounded' />
				</div>
			</div>
		</div>
	);
}
