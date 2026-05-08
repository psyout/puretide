'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EducationNav() {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const navRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (navRef.current && !navRef.current.contains(event.target as Node)) {
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

	return (
		<header
			ref={navRef}
			className='sticky top-0 z-[100] bg-white/90 backdrop-blur-[12px] border-b border-[#dde8ed]'>
			<div className='px-6 h-[70px] flex items-center justify-between'>
				<Link
					href='https://puretide.ca/'
					className='flex items-center gap-3 no-underline'
					aria-label='PureTide'>
					<svg
						className='w-8 h-8 sm:w-11 sm:h-11'
						viewBox='0 0 559.81 430.1'
						xmlns='http://www.w3.org/2000/svg'>
						<path
							fill='#1C4855'
							d='M551,279.01c-59.67,8.21-119.95-2.39-172.96-35.44l-77.85-48.54c-48.75-30.46-105.92-33.05-154.88-6.97C85.24,220.07,60.6,249.8.73,266.74l-.73-115.38C101.03,81.1,196.04,29.34,320.87,84.84c88.87,39.5,120.68,98.85,229.61,91.57l.52,102.59Z'
						/>
						<path
							fill='#1C4855'
							d='M550.59,321.73v106.23c-188.76,20.37-264.01-113.51-453.82-34.09-31.18,12.99-60.81,21.51-96.15,30.56l.21-113.09,83.57-28.79c96.04-33.16,202.38-25.88,296.76,9.67,55.61,20.9,108.2,29.1,169.43,29.52Z'
						/>
						<circle
							fill='#1C4855'
							cx='498.37'
							cy='61.45'
							r='61.45'
						/>
					</svg>
					<div className='flex flex-col gap-[1px]'>
						<span className='font-bold text-base sm:text-[1.6rem] tracking-[0.1em] text-[#1C4855] leading-none uppercase'>Pure Tide</span>
						<span className='text-[0.55rem] font-normal tracking-[0.18em] text-[#6EB4CC] uppercase leading-none'>Advanced Peptide Wellness</span>
					</div>
				</Link>

				<div className='flex items-center gap-4'>
					<nav className='hidden md:flex items-center gap-9'>
						<a
							href='https://puretide.ca/#products'
							className='text-[11px] font-semibold tracking-[0.16em] text-[#7a9aaa] no-underline uppercase transition-colors hover:text-[#1C4855]'>
							Products
						</a>
						<a
							href='https://puretide.ca/learn'
							className='text-[11px] font-semibold tracking-[0.16em] text-[#1C4855] no-underline uppercase'>
							Education
						</a>
						<a
							href='https://puretide.ca/calculator'
							className='text-[11px] font-semibold tracking-[0.16em] text-[#7a9aaa] no-underline uppercase transition-colors hover:text-[#1C4855] hidden'>
							Dosage Calculator
						</a>
						<a
							href='https://puretide.ca/#contact'
							className='text-[11px] font-semibold tracking-[0.16em] text-[#7a9aaa] no-underline uppercase transition-colors hover:text-[#1C4855]'>
							Contact
						</a>
					</nav>
					<a
						href='https://puretide.ca/shop'
						className='text-[11px] font-semibold tracking-[0.16em] text-white bg-[#1C4855] uppercase px-[20px] py-[11px] rounded transition-colors hover:bg-[#2a5f70] no-underline'>
						Shop Now
					</a>
					<button
						type='button'
						aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
						onClick={() => setIsMenuOpen((v) => !v)}
						className={`md:hidden relative w-6 h-[26px] bg-transparent border-0 cursor-pointer appearance-none focus:outline-none ml-2 ${isMenuOpen ? 'active' : ''}`}>
						<span
							className={`absolute left-0 w-full h-0.5 bg-[#1C4855] rounded-[2px] ${isMenuOpen ? 'top-[11px] -rotate-45 transition-[top,transform] duration-300 ease-[cubic-bezier(.36,-.42,.68,-.56)] [transition-delay:0s,300ms]' : 'top-0 transition-top duration-300'}`}
						/>
						<span
							className={`absolute left-0 w-full h-0.5 bg-[#1C4855] rounded-[2px] top-[10px] ${isMenuOpen ? 'opacity-0 transition-opacity duration-50 delay-300' : 'opacity-100 transition-opacity duration-300 top-3'}`}
						/>
						<span
							className={`absolute left-0 w-full h-0.5 bg-[#1C4855] rounded-[2px] ${isMenuOpen ? 'bottom-[13px] rotate-45 transition-[bottom,transform] duration-300 ease-[cubic-bezier(.36,-.42,.68,-.56)] [transition-delay:0s,300ms]' : 'bottom-1 transition-bottom duration-300'}`}
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
						className='md:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-lg shadow-xl overflow-hidden border-b border-[#dde8ed]'
						style={{ originY: 'top' }}>
						<nav className='px-10 py-6'>
							<motion.div
								className='flex flex-col gap-4'
								variants={containerVariants}>
								{[
									{ href: 'https://puretide.ca/products', label: 'Products' },
									{ href: 'https://puretide.ca/learn', label: 'Education', active: true },
									{ href: 'https://puretide.ca/#contact', label: 'Contact' },
								].map((item, index) => (
									<motion.a
										key={item.label}
										href={item.href}
										variants={itemVariants}
										className={`text-[13px] font-semibold tracking-[0.16em] uppercase transition-colors no-underline ${item.active ? 'text-[#1C4855]' : 'text-[#7a9aaa] hover:text-[#1C4855]'}`}>
										{item.label}
									</motion.a>
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
			staggerChildren: 0.05,
		},
	},
	closed: {
		scaleY: 0,
		transition: {
			when: 'afterChildren',
			staggerChildren: 0.05,
		},
	},
};

const containerVariants = {
	open: {
		transition: {
			staggerChildren: 0.05,
		},
	},
	closed: {
		transition: {
			staggerChildren: 0.05,
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
		y: -10,
		transition: {
			when: 'afterChildren',
		},
	},
};
