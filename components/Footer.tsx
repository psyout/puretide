'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { FlaskConical, LockKeyhole, Mail, MapPin } from 'lucide-react';

const footerLinks = [
	{ href: '/#products', label: 'Products' },
	{ href: '/#about', label: 'About us' },
	{ href: '/learn', label: 'Learn' },
	{ href: '/#contact', label: 'Contact' },
];

export default function Footer() {
	const pathname = usePathname();

	// The stock dashboard is an internal tool and intentionally sits outside the storefront shell.
	if (pathname.startsWith('/dashboard')) return null;

	return (
		<footer className='relative overflow-hidden bg-deep-tidal-teal-800 text-white' aria-label='Site footer'>
			<div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(77,167,182,0.13),transparent_36%),radial-gradient(circle_at_88%_100%,rgba(168,213,186,0.08),transparent_32%)]' />

			<div className='relative mx-auto max-w-7xl px-6 py-12 sm:py-14 lg:px-8'>
				<div className='border-t border-white/25 pt-10'>
					<div className='grid gap-10 md:grid-cols-[1.35fr_0.75fr_1fr] md:gap-12'>
						<div className='max-w-md'>
							<Link href='/' aria-label='Pure Tide home' className='inline-flex transition-opacity hover:opacity-80'>
								<Image
									src='/mineral-white-logo.svg'
									alt='Pure Tide — Advanced Peptide Wellness'
									width={1145}
									height={181}
									className='h-9 w-auto sm:h-10'
								/>
							</Link>
							<p className='mt-5 text-sm leading-6 text-white/60'>
								Canadian-sourced, independently tested research products with a focus on quality, clarity, and discreet service.
							</p>
							<div className='mt-5 flex flex-wrap gap-2'>
								<span className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70'>
									<MapPin className='h-3.5 w-3.5 text-eucalyptus-300' aria-hidden='true' />
									British Columbia, Canada
								</span>
								<span className='inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70'>
									<LockKeyhole className='h-3.5 w-3.5 text-eucalyptus-300' aria-hidden='true' />
									Privacy minded
								</span>
							</div>
						</div>

						<nav aria-label='Footer navigation'>
							<p className='text-xs font-semibold uppercase tracking-[0.2em] text-eucalyptus-300'>Explore</p>
							<ul className='mt-5 space-y-3'>
								{footerLinks.map((link) => (
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
							<p className='mt-5 text-sm leading-6 text-white/60'>Our team is here to help with product, order, and shipping questions.</p>
							<a
								href='mailto:info@puretide.ca'
								className='mt-5 inline-flex items-center gap-2 text-sm font-medium text-white transition-colors hover:text-eucalyptus-300'>
								<Mail className='h-4 w-4' aria-hidden='true' />
								info@puretide.ca
							</a>
						</div>
					</div>

					<div className='mt-10 flex flex-col gap-5 border-t border-white/10 pt-6 md:flex-row md:items-center md:justify-between'>
						<p className='flex max-w-2xl items-start gap-2 text-xs leading-5 text-white/45'>
							<FlaskConical className='mt-0.5 h-3.5 w-3.5 shrink-0' aria-hidden='true' />
							Products are intended strictly for laboratory research and are not for human or veterinary use.
						</p>
						<p className='shrink-0 text-xs text-white/40'>© 2026 Pure Tide Peptides. All rights reserved.</p>
					</div>
				</div>
			</div>
		</footer>
	);
}
