'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { PRODUCT_CATEGORY_EVENT, PRODUCT_MENU_CATEGORIES, type ProductFilterCategory } from '@/lib/productCategories';
import CartIcon from './CartIcon';
import Logo from './Logo';

function MapleLeafIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			viewBox='-1953 -2031 3906 4061'
			className={className}
			aria-hidden='true'
			focusable='false'>
			<path
				fill='#FFFFFF'
				d='m-90 2030 45-863a95 95 0 0 0-111-98l-859 151 116-320a65 65 0 0 0-20-73l-941-762 212-99a65 65 0 0 0 34-79l-186-572 542 115a65 65 0 0 0 73-38l105-247 423 454a65 65 0 0 0 111-57l-204-1052 327 189a65 65 0 0 0 91-27l332-652 332 652a65 65 0 0 0 91 27l327-189-204 1052a65 65 0 0 0 111 57l423-454 105 247a65 65 0 0 0 73 38l542-115-186 572a65 65 0 0 0 34 79l212 99-941 762a65 65 0 0 0-20 73l116 320-859-151a95 95 0 0 0-111 98l45 863z'
			/>
		</svg>
	);
}

export default function Header({ stacked = false }: { stacked?: boolean }) {
	const router = useRouter();
	const pathname = usePathname();
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isProductsMenuOpen, setIsProductsMenuOpen] = useState(false);
	const [isAboutMenuOpen, setIsAboutMenuOpen] = useState(false);
	const [isMobileProductsOpen, setIsMobileProductsOpen] = useState(false);
	const [isMobileAboutOpen, setIsMobileAboutOpen] = useState(false);
	const headerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setIsMenuOpen(false);
		setIsProductsMenuOpen(false);
		setIsAboutMenuOpen(false);
		setIsMobileProductsOpen(false);
		setIsMobileAboutOpen(false);
	}, [pathname]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
				setIsMenuOpen(false);
				setIsProductsMenuOpen(false);
				setIsAboutMenuOpen(false);
			}
		};
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setIsMenuOpen(false);
				setIsProductsMenuOpen(false);
				setIsAboutMenuOpen(false);
			}
		};

		if (isMenuOpen || isProductsMenuOpen || isAboutMenuOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			document.addEventListener('keydown', handleEscape);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isAboutMenuOpen, isMenuOpen, isProductsMenuOpen]);

	const scrollToSection = (targetId: string) => {
		setIsMenuOpen(false);
		setIsProductsMenuOpen(false);
		setIsAboutMenuOpen(false);
		if (typeof window !== 'undefined' && window.location.pathname === '/') {
			document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
			return;
		}

		router.push('/');
		setTimeout(() => {
			document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
		}, 200);
	};

	const selectProductCategory = (category: Exclude<ProductFilterCategory, 'All'>) => {
		setIsMenuOpen(false);
		setIsProductsMenuOpen(false);
		setIsMobileProductsOpen(false);

		const destination = `/?category=${encodeURIComponent(category)}#products`;
		if (typeof window !== 'undefined' && window.location.pathname === '/') {
			window.history.replaceState(window.history.state, '', destination);
			window.dispatchEvent(new CustomEvent(PRODUCT_CATEGORY_EVENT, { detail: { category } }));
			document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
			return;
		}

		router.push(destination);
	};

	return (
		<header
			ref={headerRef}
			className={stacked ? 'bg-deep-tidal-teal-600/80 backdrop-blur-md relative z-[100]' : 'bg-deep-tidal-teal-600/80 backdrop-blur-md fixed top-0 left-0 right-0 z-[100]'}>
			<div className='max-w-7xl mx-auto px-6 sm:px-6 py-4 flex items-center'>
				<div className='flex items-center'>
					<Link
						href='/'
						className='flex items-center transition-opacity hover:opacity-80'>
						<Logo className='h-6 sm:h-7 w-auto' />
					</Link>
					<span className='ml-3 sm:ml-6 inline-flex items-center gap-2 text-white font-medium tracking-wide text-sm sm:text-base cursor-default'>
						<span className='text-[1rem] mt-[0.4rem] flex gap-1'>
							Proudly
							<MapleLeafIcon className='h-[1.35rem] w-auto' /> Canadian
						</span>
					</span>
				</div>

				<div className='ml-auto flex items-center gap-2 sm:gap-4'>
					<nav className='hidden md:flex items-center gap-4' aria-label='Main navigation'>
						<div
							className='relative'
							onMouseEnter={() => setIsProductsMenuOpen(true)}
							onMouseLeave={() => setIsProductsMenuOpen(false)}
							onBlur={(event) => {
								const menu = event.currentTarget;
								window.setTimeout(() => {
									if (!menu.contains(document.activeElement)) setIsProductsMenuOpen(false);
								}, 0);
							}}>
							<button
								type='button'
								onClick={() => scrollToSection('products')}
								onFocus={() => setIsProductsMenuOpen(true)}
								aria-haspopup='menu'
								aria-expanded={isProductsMenuOpen}
								className='inline-flex items-center gap-1 font-medium uppercase text-white transition-colors hover:text-muted-sage-200'>
								PRODUCTS
								<ChevronDown className={`h-4 w-4 transition-transform ${isProductsMenuOpen ? 'rotate-180' : ''}`} aria-hidden='true' />
							</button>
							<AnimatePresence>
								{isProductsMenuOpen && (
									<div className='absolute left-1/2 top-full w-52 -translate-x-1/2 pt-5'>
										<motion.div
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											exit={{ opacity: 0 }}
											transition={{ duration: 0.16 }}
											className='relative rounded-xl border border-deep-tidal-teal-800/10 bg-white p-2 text-deep-tidal-teal-900 shadow-[0_16px_42px_rgba(5,32,39,0.2)]'
											role='menu'>
											<span className='absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-deep-tidal-teal-800/10 bg-white' aria-hidden='true' />
											{PRODUCT_MENU_CATEGORIES.map((category) => (
												<button key={category} type='button' role='menuitem' onClick={() => selectProductCategory(category)} className='block w-full rounded-lg px-4 py-2.5 text-left text-sm font-semibold transition hover:bg-deep-tidal-teal/5 hover:text-deep-tidal-teal'>
													{category}
												</button>
											))}
										</motion.div>
									</div>
								)}
							</AnimatePresence>
						</div>
						<div className='hidden sm:block w-0.5 h-4 bg-mineral-white' />
						<div
							className='relative'
							onMouseEnter={() => setIsAboutMenuOpen(true)}
							onMouseLeave={() => setIsAboutMenuOpen(false)}
							onBlur={(event) => {
								const menu = event.currentTarget;
								window.setTimeout(() => {
									if (!menu.contains(document.activeElement)) setIsAboutMenuOpen(false);
								}, 0);
							}}>
							<button
								type='button'
								onClick={() => scrollToSection('about')}
								onFocus={() => setIsAboutMenuOpen(true)}
								aria-haspopup='menu'
								aria-expanded={isAboutMenuOpen}
								className='inline-flex items-center gap-1 hover:text-muted-sage-200 text-white transition-colors font-medium uppercase'>
								ABOUT US
								<ChevronDown className={`h-4 w-4 transition-transform ${isAboutMenuOpen ? 'rotate-180' : ''}`} aria-hidden='true' />
							</button>
							<AnimatePresence>
								{isAboutMenuOpen && (
									<div className='absolute left-1/2 top-full w-48 -translate-x-1/2 pt-5'>
										<motion.div
											initial={{ opacity: 0, y: -6 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -6 }}
											transition={{ duration: 0.16 }}
											className='relative rounded-xl border border-deep-tidal-teal-800/10 bg-white p-2 text-deep-tidal-teal-900 shadow-[0_16px_42px_rgba(5,32,39,0.2)]'
											role='menu'>
											<span className='absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-deep-tidal-teal-800/10 bg-white' aria-hidden='true' />
											<Link href='/learn' role='menuitem' className='block rounded-lg px-4 py-3 text-sm font-semibold transition hover:bg-deep-tidal-teal/5 hover:text-deep-tidal-teal'>Learn</Link>
											<Link href='/faq' role='menuitem' className='block rounded-lg px-4 py-3 text-sm font-semibold transition hover:bg-deep-tidal-teal/5 hover:text-deep-tidal-teal'>FAQ</Link>
										</motion.div>
									</div>
								)}
							</AnimatePresence>
						</div>
						<div className='hidden sm:block w-0.5 h-4 bg-mineral-white' />
						<Link href='/affiliate' className='hover:text-muted-sage-200 text-white transition-colors font-medium uppercase'>AFFILIATE</Link>
						<div className='hidden sm:block w-0.5 h-4 bg-mineral-white' />
						<button
							type='button'
							onClick={() => scrollToSection('contact')}
							className='hover:text-muted-sage-200 text-white transition-colors font-medium uppercase'>
							CONTACT
						</button>
						<div className='hidden sm:block w-0.5 h-4 bg-mineral-white' />
					</nav>
					<div className='text-mineral-white hover:text-muted-sage-200 transition-colors mt-1 md:mt-1'>
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
								<motion.div variants={itemVariants}>
									<button type='button' onClick={() => setIsMobileProductsOpen((open) => !open)} aria-expanded={isMobileProductsOpen} aria-controls='mobile-products-menu' className='flex w-full items-center justify-between rounded-lg px-2 py-1 text-left font-medium text-white transition-colors hover:text-muted-sage-200'>
										<span>PRODUCTS</span>
										<ChevronDown className={`h-4 w-4 transition-transform ${isMobileProductsOpen ? 'rotate-180' : ''}`} aria-hidden='true' />
									</button>
									<AnimatePresence initial={false}>
										{isMobileProductsOpen && (
											<motion.div id='mobile-products-menu' initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className='ml-3 overflow-hidden border-l border-white/25 pl-4'>
												{PRODUCT_MENU_CATEGORIES.map((category) => (
													<button key={category} type='button' onClick={() => selectProductCategory(category)} className='block w-full py-2 text-left text-sm font-medium text-white/90 transition hover:text-muted-sage-200'>
														{category.toUpperCase()}
													</button>
												))}
											</motion.div>
										)}
									</AnimatePresence>
								</motion.div>
								<motion.div variants={itemVariants}>
									<button type='button' onClick={() => setIsMobileAboutOpen((open) => !open)} aria-expanded={isMobileAboutOpen} aria-controls='mobile-about-menu' className='flex w-full items-center justify-between rounded-lg px-2 py-1 text-left font-medium text-white transition-colors hover:text-muted-sage-200'>
										<span>ABOUT US</span>
										<ChevronDown className={`h-4 w-4 transition-transform ${isMobileAboutOpen ? 'rotate-180' : ''}`} aria-hidden='true' />
									</button>
									<AnimatePresence initial={false}>
										{isMobileAboutOpen && (
											<motion.div id='mobile-about-menu' initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className='ml-3 overflow-hidden border-l border-white/25 pl-4'>
												<Link href='/learn' className='block py-2 text-sm font-medium text-white/90 transition hover:text-muted-sage-200'>LEARN</Link>
												<Link href='/faq' className='block py-2 text-sm font-medium text-white/90 transition hover:text-muted-sage-200'>FAQ</Link>
											</motion.div>
										)}
									</AnimatePresence>
								</motion.div>
								<motion.div variants={itemVariants}>
									<Link href='/affiliate' className='block px-2 py-1 text-left font-medium text-white transition-colors hover:text-muted-sage-200'>AFFILIATE</Link>
								</motion.div>
								<motion.button variants={itemVariants} onClick={() => scrollToSection('contact')} className='px-2 py-1 text-left font-medium text-white transition-colors hover:text-muted-sage-200'>CONTACT</motion.button>
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
