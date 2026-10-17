'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { FlaskConical, Mail } from 'lucide-react';
import { PRODUCT_CATEGORY_EVENT, PRODUCT_MENU_CATEGORIES, type ProductFilterCategory } from '@/lib/productCategories';

const companyLinks = [
	{ href: '/#about', label: 'About us' },
	{ href: '/learn', label: 'Learn' },
	{ href: '/#contact', label: 'Contact' },
];

export default function Footer() {
	const pathname = usePathname();
	const router = useRouter();

	const selectProductCategory = (category: Exclude<ProductFilterCategory, 'All'>) => {
		const destination = `/?category=${encodeURIComponent(category)}#products`;
		if (typeof window !== 'undefined' && window.location.pathname === '/') {
			window.history.replaceState(window.history.state, '', destination);
			window.dispatchEvent(new CustomEvent(PRODUCT_CATEGORY_EVENT, { detail: { category } }));
			document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
			return;
		}

		router.push(destination);
	};

	// The stock dashboard is an internal tool and intentionally sits outside the storefront shell.
	if (pathname.startsWith('/dashboard')) return null;

	return (
		<footer
			className='relative overflow-hidden bg-deep-tidal-teal-800 text-white'
			aria-label='Site footer'>
			<div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(77,167,182,0.13),transparent_36%),radial-gradient(circle_at_88%_100%,rgba(168,213,186,0.08),transparent_32%)]' />

			<div className='relative mx-auto max-w-7xl px-6 py-12 sm:py-14 lg:px-8'>
				<div className='border-t border-white/25 pt-10'>
					<div className='grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_0.75fr_1fr] lg:gap-12'>
						<div className='max-w-md'>
							<Link
								href='/'
								aria-label='Pure Tide home'
								className='inline-flex transition-opacity hover:opacity-80'>
								<Image
									src='/mineral-white-logo.svg'
									alt='Pure Tide — Advanced Peptide Wellness'
									width={1145}
									height={181}
									className='h-9 w-auto sm:h-10'
								/>
							</Link>
							<p className='mt-5 text-[1rem] leading-6 text-white/60'>
								Canadian-sourced, independently tested research products with a focus on quality, clarity and transparency.
							</p>
						</div>

						<nav aria-label='Product categories'>
							<Link href='/#products' className='text-xs font-semibold uppercase tracking-[0.2em] text-eucalyptus-300 transition-colors hover:text-white'>Products</Link>
							<ul className='mt-5 space-y-3'>
								{PRODUCT_MENU_CATEGORIES.map((category) => (
									<li key={category}>
										<Link
											href={`/?category=${encodeURIComponent(category)}#products`}
											onClick={(event) => {
												event.preventDefault();
												selectProductCategory(category);
											}}
											className='text-sm text-white/65 transition-colors hover:text-white focus-visible:text-white'>
											{category}
										</Link>
									</li>
								))}
							</ul>
						</nav>

						<nav aria-label='Company navigation'>
							<p className='text-xs font-semibold uppercase tracking-[0.2em] text-eucalyptus-300'>Company</p>
							<ul className='mt-5 space-y-3'>
								{companyLinks.map((link) => (
									<li key={link.label}>
										<Link href={link.href} className='text-sm text-white/65 transition-colors hover:text-white focus-visible:text-white'>
											{link.label}
										</Link>
									</li>
								))}
							</ul>
						</nav>

						<div>
							<p className='text-xs font-semibold uppercase tracking-[0.2em] text-eucalyptus-300'>Questions?</p>
							<p className='mt-5 text-[1rem] leading-6 text-white/60'>Help with products, orders & shipping?</p>
							<a
								href='mailto:info@puretide.ca'
								className='mt-5 inline-flex items-center gap-2 text-[1rem] font-medium text-white transition-colors hover:text-eucalyptus-300'>
								<Mail
									className='h-4 w-4'
									aria-hidden='true'
								/>
								info@puretide.ca
							</a>
						</div>
					</div>

					<div className='mt-10 flex flex-col gap-5 border-t border-white/10 pt-6 md:flex-row md:items-center md:justify-between'>
						<p className='flex max-w-2xl items-start gap-2 text-xs leading-5 text-white/45'>
							<FlaskConical
								className='mt-0.5 h-3.5 w-3.5 shrink-0'
								aria-hidden='true'
							/>
							Products are intended strictly for laboratory research and are not for human or veterinary use.
						</p>
						<p className='shrink-0 text-xs text-white/40'>© 2026 Pure Tide Peptides. All rights reserved.</p>
					</div>
				</div>
			</div>
		</footer>
	);
}
