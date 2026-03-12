'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CartIcon from './CartIcon';
import Logo from './Logo';

export default function Header() {
	const router = useRouter();
	const pathname = usePathname();
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const headerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setIsMenuOpen(false);
	}, [pathname]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
				setIsMenuOpen(false);
			}
		};

		if (isMenuOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isMenuOpen]);

	const scrollToSection = (targetId: string) => {
		setIsMenuOpen(false);
		if (typeof window !== 'undefined' && window.location.pathname === '/') {
			document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
			return;
		}

		router.push('/');
		setTimeout(() => {
			document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
		}, 200);
	};

	return (
		<header
			ref={headerRef}
			className='bg-deep-tidal-teal-600/80 backdrop-blur-md fixed top-0 left-0 right-0 z-[100]'>
			<div className='max-w-7xl mx-auto px-6 sm:px-6 py-4 flex items-center'>
				<Link
					href='/'
					className='flex items-center transition-opacity hover:opacity-80'>
					<Logo className='h-8 sm:h-10 w-auto' />
				</Link>

				<div className='ml-auto flex items-center gap-1 sm:gap-4'>
					<nav className='hidden md:flex items-center gap-6'>
						<button
							type='button'
							onClick={() => scrollToSection('products')}
							className='hover:text-muted-sage-200 text-white transition-colors uppercase font-medium'>
							Products
						</button>
						<div className='hidden sm:block w-0.5 h-4 bg-mineral-white' />
						<button
							type='button'
							onClick={() => scrollToSection('about')}
							className='hover:text-muted-sage-200 text-white transition-colors uppercase font-medium'>
							About us
						</button>
						<div className='hidden sm:block w-0.5 h-4 bg-mineral-white' />
						<button
							type='button'
							onClick={() => scrollToSection('contact')}
							className='hover:text-muted-sage-200 text-white transition-colors uppercase font-medium'>
							Contact
						</button>
						<div className='hidden sm:block w-0.5 h-4 bg-mineral-white' />
					</nav>
					<div className='text-mineral-white hover:text-muted-sage-200 transition-colors mt-2 md:mt-1'>
						<CartIcon />
					</div>
					<button
						type='button'
						aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
						onClick={() => setIsMenuOpen((v) => !v)}
						className={`md:hidden relative w-6 h-[26px] bg-transparent mt-[0.1rem] border-0 cursor-pointer appearance-none focus:outline-none ml-2 ${isMenuOpen ? 'active' : ''}`}
						id='menu04'>
						<span
							className={`absolute left-0 w-full h-0.5 bg-white rounded-[2px] ${isMenuOpen ? 'top-[11px] -rotate-45 transition-[top,transform] duration-300 ease-[cubic-bezier(.36,-.42,.68,-.56)] [transition-delay:0s,300ms]' : 'top-0 transition-top duration-300'}`}
						/>
						<span
							className={`absolute left-0 w-full h-0.5 bg-white rounded-[2px] top-[10px] ${isMenuOpen ? 'opacity-0 transition-opacity duration-50 delay-300' : 'opacity-100 transition-opacity duration-300 top-3'}`}
						/>
						<span
							className={`absolute left-0 w-full h-0.5 bg-white rounded-[2px] ${isMenuOpen ? 'bottom-[13px] rotate-45 transition-[bottom,transform] duration-300 ease-[cubic-bezier(.36,-.42,.68,-.56)] [transition-delay:0s,300ms]' : 'bottom-1 transition-bottom duration-300'}`}
						/>
					</button>
				</div>
			</div>

			<AnimatePresence>
				{isMenuOpen && (
					<motion.div
						initial='closed'
						animate='open'
						exit='closed'
						variants={wrapperVariants}
						className='md:hidden absolute top-full left-0 right-0 bg-deep-tidal-teal-600/80 backdrop-blur-lg shadow-xl overflow-hidden'
						style={{ originY: 'top' }}>
						<nav className='max-w-7xl mx-auto px-4 sm:px-6 py-4'>
							<motion.div
								className='flex flex-col gap-2'
								variants={containerVariants}>
								{['products', 'about', 'contact'].map((item, index) => (
									<motion.button
										key={item}
										variants={itemVariants}
										onClick={() => scrollToSection(item)}
										className='text-left hover:text-muted-sage-200 text-white transition-colors uppercase font-medium py-1 px-2 cursor-pointer'>
										{item === 'products' && 'Products'}
										{item === 'about' && 'About us'}
										{item === 'contact' && 'Contact'}
									</motion.button>
								))}
							</motion.div>
						</nav>
					</motion.div>
				)}
			</AnimatePresence>
		</header>
	);
}

const wrapperVariants = {
	open: {
		scaleY: 1,
		transition: {
			when: 'beforeChildren',
			staggerChildren: 0.1,
		},
	},
	closed: {
		scaleY: 0,
		transition: {
			when: 'afterChildren',
			staggerChildren: 0.1,
		},
	},
};

const containerVariants = {
	open: {
		transition: {
			staggerChildren: 0.1,
		},
	},
	closed: {
		transition: {
			staggerChildren: 0.1,
		},
	},
};

const itemVariants = {
	open: {
		opacity: 1,
		y: 0,
		transition: {
			when: 'beforeChildren',
		},
	},
	closed: {
		opacity: 0,
		y: -15,
		transition: {
			when: 'afterChildren',
		},
	},
};
