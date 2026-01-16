import Link from 'next/link';

export default function OrderConfirmationPage() {
	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<div className='container mx-auto px-4 py-16'>
				<div className='max-w-3xl mx-auto bg-eucalyptus-100/60 backdrop-blur-sm rounded-lg border border-muted-sage-400 p-8 shadow-lg'>
					<h1 className='text-4xl font-bold text-deep-tidal-teal-800 mb-4'>Order placed</h1>
					<p className='text-deep-tidal-teal-800 mb-6'>Thank you for your order. Payment is completed only via Interac e-Transfer in Canada.</p>

					<div className='rounded-lg bg-mineral-white border border-muted-sage-300 p-6 mb-6'>
						<h2 className='text-2xl font-semibold text-deep-tidal-teal-800 mb-3'>Interac e-Transfer</h2>
						<p className='text-deep-tidal-teal-800 mb-3'>After placing your order, please send an e-Transfer with the instructions provided.</p>
						<p className='text-deep-tidal-teal-800'>You will receive the question and password to complete the transfer.</p>
					</div>

					<div className='text-sm text-deep-tidal-teal-800 mb-8'>
						<p>
							Your personal data will be used to process your order, support your experience on this website, and for other purposes described in our privacy policy. All products
							are sold strictly for laboratory research purposes only and are not intended for human or veterinary use.
						</p>
					</div>

					<div className='flex flex-wrap gap-4'>
						<Link
							href='/'
							className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 text-mineral-white font-semibold py-3 px-6 rounded transition-colors'>
							Continue shopping
						</Link>
						<Link
							href='/contact'
							className='border border-deep-tidal-teal text-deep-tidal-teal hover:bg-deep-tidal-teal hover:text-mineral-white font-semibold py-3 px-6 rounded transition-colors'>
							Need help?
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
