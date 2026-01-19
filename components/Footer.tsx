export default function Footer() {
	return (
		<footer className='border-t border-deep-tidal-teal-500 mt-20 py-8'>
			<div className='container mx-auto px-4 text-center text-deep-tidal-teal-700 text-sm'>
				<p className='flex items-center justify-center gap-2'>
					<svg
						className='w-4 h-4'
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={1.5}
							d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
						/>
					</svg>
					Privacy First • No Tracking • Anonymous Transactions
				</p>
				<p className='mt-2'>Copyright © 2026 Pure Tide Peptides. All rights reserved.</p>
			</div>
		</footer>
	);
}
