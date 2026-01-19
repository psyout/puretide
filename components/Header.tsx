import Link from 'next/link';
import CartIcon from './CartIcon';
import Logo from './Logo';

export default function Header() {
	return (
		<header className='bg-deep-tidal-teal-600/30 backdrop-blur-md fixed top-0 left-0 right-0 z-[100]'>
			<div className='container mx-auto px-4 py-4 flex justify-between items-center'>
				<Link
					href='/'
					className='flex items-center transition-opacity hover:opacity-80'>
					<Logo />
				</Link>
				<nav className='flex items-center gap-6'>
					<Link
						href='#products'
						className='hover:text-muted-sage-200 text-white transition-colors uppercase font-bold'>
						Products
					</Link>
					<div className='text-mineral-white hover:text-muted-sage-200 transition-colors'>
						<CartIcon />
					</div>
				</nav>
			</div>
		</header>
	);
}
