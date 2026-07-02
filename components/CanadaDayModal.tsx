'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

function CanadaMapleLeafIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			viewBox='-1953 -2031 3906 4061'
			className={className}
			aria-hidden='true'
			focusable='false'>
			<path
				fill='currentColor'
				d='m-90 2030 45-863a95 95 0 0 0-111-98l-859 151 116-320a65 65 0 0 0-20-73l-941-762 212-99a65 65 0 0 0 34-79l-186-572 542 115a65 65 0 0 0 73-38l105-247 423 454a65 65 0 0 0 111-57l-204-1052 327 189a65 65 0 0 0 91-27l332-652 332 652a65 65 0 0 0 91 27l327-189-204 1052a65 65 0 0 0 111 57l423-454 105 247a65 65 0 0 0 73 38l542-115-186 572a65 65 0 0 0 34 79l212 99-941 762a65 65 0 0 0-20 73l116 320-859-151a95 95 0 0 0-111 98l45 863z'
			/>
		</svg>
	);
}

function safeSetStorage(storage: Storage, key: string, value: string) {
	try {
		storage.setItem(key, value);
	} catch {
		// ignore
	}
}

function safeGetStorage(storage: Storage, key: string) {
	try {
		return storage.getItem(key);
	} catch {
		return null;
	}
}

async function copyText(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		try {
			const el = document.createElement('textarea');
			el.value = text;
			el.setAttribute('readonly', '');
			el.style.position = 'fixed';
			el.style.left = '-9999px';
			document.body.appendChild(el);
			el.select();
			const ok = document.execCommand('copy');
			document.body.removeChild(el);
			return ok;
		} catch {
			return false;
		}
	}
}

export default function CanadaDayModal() {
	const pathname = usePathname();
	const [isOpen, setIsOpen] = useState(false);
	const [copiedCode, setCopiedCode] = useState<string | null>(null);

	const excluded = useMemo(() => {
		const p = pathname || '';
		return p.startsWith('/checkout') || p.startsWith('/order-confirmation') || p.startsWith('/dashboard');
	}, [pathname]);

	useEffect(() => {
		if (excluded) return;
		if (typeof window === 'undefined') return;

		const SHOWN_KEY = 'pt_canada_day_2026_shown_session_v1';
		try {
			if (window.sessionStorage.getItem(SHOWN_KEY) === '1') return;
		} catch {
			// ignore
		}

		const t = window.setTimeout(() => {
			try {
				if (window.sessionStorage.getItem(SHOWN_KEY) === '1') return;
				window.sessionStorage.setItem(SHOWN_KEY, '1');
			} catch {
				// ignore
			}
			setIsOpen(true);
		}, 650);
		return () => window.clearTimeout(t);
	}, [excluded]);

	useEffect(() => {
		if (!copiedCode) return;
		const t = window.setTimeout(() => setCopiedCode(null), 1500);
		return () => window.clearTimeout(t);
	}, [copiedCode]);

	const close = () => {
		setIsOpen(false);
	};

	const handleCopy = async (code: string) => {
		const ok = await copyText(code);
		if (ok) setCopiedCode(code);
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					className='fixed inset-0 z-[200] flex items-center justify-center p-4'
					role='dialog'
					aria-modal='true'
					aria-label='Canada Day Special'
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.18, ease: 'easeOut' }}>
					<motion.button
						type='button'
						className='absolute inset-0 bg-black/55 backdrop-blur-[1px]'
						onClick={close}
						aria-label='Close modal'
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.18, ease: 'easeOut' }}
					/>

					<motion.div
						className='relative w-full max-w-xl rounded-2xl bg-mineral-white shadow-2xl ui-border overflow-hidden'
						initial={{ opacity: 0, y: 14, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 10, scale: 0.98 }}
						transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
						<div className='px-5 sm:px-7 pt-5 sm:pt-7 pb-4 bg-gradient-to-br from-mineral-white via-mineral-white to-deep-tidal-teal-50'>
							<div className='flex items-start gap-4'>
								<div className='shrink-0 rounded-xl bg-white ui-border shadow-sm p-3'>
									<CanadaMapleLeafIcon className='h-7 w-7 text-red-600' />
								</div>
								<div className='min-w-0 flex-1'>
									<div className='flex items-start justify-between gap-3'>
										<h2 className='text-xl sm:text-2xl font-bold text-deep-tidal-teal-800 tracking-tight'>Canada Day Special</h2>
										<button
											type='button'
											onClick={close}
											className='shrink-0 text-deep-tidal-teal-700 hover:text-deep-tidal-teal-900 rounded-full text-4xl leading-none'
											aria-label='Close'>
											×
										</button>
									</div>
									<p className='mt-1 text-sm sm:text-base text-deep-tidal-teal-700'>Celebrate Canada Day with exclusive savings</p>
									<p className='mt-1 text-xs sm:text-sm text-deep-tidal-teal-600 font-semibold'>Sale ends on July 7th</p>
								</div>
							</div>
						</div>

						<div className='px-5 sm:px-7 pb-6 sm:pb-7'>
							<div className='space-y-3'>
								<div className='rounded-xl bg-white ui-border shadow-sm p-4'>
									<div className='flex items-center justify-between gap-3'>
										<div className='min-w-0'>
											<p className='text-sm text-deep-tidal-teal-700'>Use code</p>
											<p className='text-lg sm:text-xl font-bold text-deep-tidal-teal-900 tracking-wide'>CANADIAN10</p>
											<p className='text-sm text-deep-tidal-teal-700'>for 10% off sitewide</p>
										</div>
										<button
											type='button'
											onClick={() => handleCopy('CANADIAN10')}
											className='shrink-0 rounded-lg bg-deep-tidal-teal text-mineral-white hover:bg-deep-tidal-teal-600 transition-colors font-semibold px-3 py-2 text-sm'>
											{copiedCode === 'CANADIAN10' ? 'Copied' : 'Copy'}
										</button>
									</div>
								</div>

								<div className='rounded-xl bg-white ui-border shadow-sm p-4'>
									<div className='flex items-center justify-between gap-3'>
										<div className='min-w-0'>
											<p className='text-sm text-deep-tidal-teal-700'>Use code</p>
											<p className='text-lg sm:text-xl font-bold text-deep-tidal-teal-900 tracking-wide'>CANADIAN20</p>
											<p className='text-sm text-deep-tidal-teal-700'>for 20% off orders over $350</p>
										</div>
										<button
											type='button'
											onClick={() => handleCopy('CANADIAN20')}
											className='shrink-0 rounded-lg bg-deep-tidal-teal text-mineral-white hover:bg-deep-tidal-teal-600 transition-colors font-semibold px-3 py-2 text-sm'>
											{copiedCode === 'CANADIAN20' ? 'Copied' : 'Copy'}
										</button>
									</div>
								</div>
							</div>

							<div className='mt-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end'>
								<button
									type='button'
									onClick={close}
									className='w-full sm:w-auto rounded-lg px-5 py-2.5 font-semibold ui-border bg-white hover:bg-mineral-white-200 transition-colors text-deep-tidal-teal-800'>
									Close
								</button>
								<Link
									href='/'
									onClick={close}
									className='w-full sm:w-auto text-center rounded-lg px-5 py-2.5 font-semibold bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 transition-colors text-mineral-white'>
									Shop Now
								</Link>
							</div>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
