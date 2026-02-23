import Header from '@/components/Header';
import { Loader2 } from 'lucide-react';

export default function RootLoading() {
	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-eucalyptus-50 to-deep-tidal-teal-100'>
			<Header />
			<div className='flex flex-col items-center justify-center min-h-[60vh]'>
				<Loader2 className='w-8 h-8 text-deep-tidal-teal animate-spin' aria-hidden />
			</div>
		</div>
	);
}
