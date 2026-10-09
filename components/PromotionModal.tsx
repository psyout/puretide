'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { PromotionCampaign } from '@/types/product';

function titleParts(title: string): { primary: string; accent: string } {
	const words = title.trim().split(/\s+/).filter(Boolean);
	if (words.length <= 1) return { primary: title.toUpperCase(), accent: '' };
	return {
		primary: words.slice(0, -1).join(' ').toUpperCase(),
		accent: words[words.length - 1].toUpperCase(),
	};
}

type PromotionModalProps = {
	campaign: PromotionCampaign;
};

export default function PromotionModal({ campaign }: PromotionModalProps) {
	const pathname = usePathname();
	const [isOpen, setIsOpen] = useState(false);
	const backgroundImage = campaign.backgroundImage?.trim() || '';
	const hasBackgroundImage = true;
	const { primary, accent } = titleParts(campaign.title);

	const excluded = useMemo(() => {
		const p = pathname || '';
		return p.startsWith('/checkout') || p.startsWith('/order-confirmation') || p.startsWith('/dashboard');
	}, [pathname]);

	useEffect(() => {
		if (excluded) return;
		if (typeof window === 'undefined') return;

		const shownKey = `pt_promotion_${campaign.id}_shown_session_v1`;
		try {
			if (window.sessionStorage.getItem(shownKey) === '1') return;
		} catch {
			// ignore
		}

		const t = window.setTimeout(() => {
			try {
				if (window.sessionStorage.getItem(shownKey) === '1') return;
				window.sessionStorage.setItem(shownKey, '1');
			} catch {
				// ignore
			}
			setIsOpen(true);
		}, 650);
		return () => window.clearTimeout(t);
	}, [campaign.id, excluded]);

	const close = () => {
		setIsOpen(false);
	};

	const shopNow = () => {
		close();
		window.setTimeout(() => {
			document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}, 180);
	};

	const backgroundStyle = hasBackgroundImage
		? {
				backgroundImage: `linear-gradient(180deg, rgba(3, 20, 36, 0.15), rgba(2, 17, 31, 0.25)), url(/promotions/summer-sale.jpeg)`,
				backgroundSize: 'cover',
				backgroundPosition: 'center',
			}
		: undefined;

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					className='fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto overflow-x-hidden p-3 sm:p-4'
					role='dialog'
					aria-modal='true'
					aria-label={campaign.title}
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
						className={`relative h-auto w-[calc(100vw-24px)] max-w-[550px] overflow-hidden rounded-[18px] border shadow-[0_28px_90px_rgba(0,0,0,0.35)] sm:h-auto sm:w-[min(calc(100vw-2rem),550px)] ${hasBackgroundImage ? 'border-cyan-300/25 bg-[#031424] text-white' : 'border-black/10 bg-white text-[#0b2d3a]'}`}
						initial={{ opacity: 0, y: 14, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 10, scale: 0.98 }}
						transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
						<div
							className={`relative flex h-full px-5 py-8 sm:px-8 sm:py-10 md:px-10 md:py-12 ${hasBackgroundImage ? '' : 'bg-white'}`}
							style={backgroundStyle}>
							{hasBackgroundImage && (
								<>
									<div className='absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(23,180,206,0.08),transparent_28%),radial-gradient(circle_at_82%_72%,rgba(36,207,225,0.10),transparent_28%)]' />
									<div className='absolute inset-x-0 bottom-0 h-[15%] bg-[linear-gradient(180deg,transparent,rgba(5,62,91,0.25)),repeating-linear-gradient(168deg,rgba(50,191,222,0.03)_0px,rgba(50,191,222,0.03)_2px,transparent_4px,transparent_18px)]' />
								</>
							)}

							<button
								type='button'
								onClick={close}
								className={`absolute right-4 top-3 z-20 rounded-full px-2 text-3xl leading-none transition-colors ${hasBackgroundImage ? 'text-white/70 hover:text-white' : 'text-[#0b2d3a]/55 hover:text-[#0b2d3a]'}`}
								aria-label='Close'>
								×
							</button>

							<div className='relative z-10 mx-auto flex min-h-full max-w-[480px] flex-col items-center justify-center text-center'>
								<Image
									src='/logo.png'
									alt='Pure Tide Advanced Peptide Wellness'
									width={80}
									height={80}
									className='w-[60px] drop-shadow-[0_8px_18px_rgba(0,0,0,0.18)] sm:w-[80px] brightness-0 invert'
								/>

								<div className='mt-3 sm:mt-5'>
									<h2
										className={`font-black uppercase leading-[0.86] tracking-[-0.06em] text-[clamp(1.5rem,6vw,3rem)] sm:text-[clamp(2rem,7vw,4rem)] drop-shadow-[0_6px_18px_rgba(0,0,0,0.18)] ${hasBackgroundImage ? 'text-white' : 'text-[#0b2d3a]'}`}>
										<span className='block'>{primary}</span>
										{accent && <span className='mt-1 block bg-gradient-to-b from-[#31d8df] to-[#16adb9] bg-clip-text text-transparent'>{accent}</span>}
									</h2>
									<div className='mx-auto mt-1 h-[2px] w-12 bg-[#26c8d0] sm:w-16' />
								</div>

								{campaign.message && (
									<p
										className={`mt-4 max-w-[440px] text-[clamp(1.2rem,2vw,1.5rem)] font-semibold leading-[1.4] drop-shadow sm:mt-5 ${hasBackgroundImage ? 'text-white/95' : 'text-[#0b2d3a]/80'}`}>
										{campaign.message}
									</p>
								)}

								<div className='mt-5 flex w-full max-w-[300px] flex-col items-center sm:mt-6'>
									<div className='h-px w-full bg-gradient-to-r from-transparent via-[#27d2dc] to-transparent' />
									<button
										type='button'
										onClick={shopNow}
										className='mt-5 inline-flex min-w-[170px] items-center justify-center rounded-full bg-[#25c8d2] px-7 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#031424] shadow-[0_10px_30px_rgba(37,200,210,0.3)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#45dce4] hover:shadow-[0_14px_34px_rgba(37,200,210,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#031424] active:translate-y-0 sm:text-base'>
										Shop now
									</button>
								</div>
							</div>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
