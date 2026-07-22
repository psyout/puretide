'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { PromotionCampaign } from '@/types/product';

function formatCurrency(value: number) {
	return new Intl.NumberFormat('en-CA', {
		style: 'currency',
		currency: 'CAD',
		maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
	}).format(value);
}

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
							className={`relative flex h-full px-3 py-3 sm:px-6 sm:py-6 md:px-8 md:py-7 ${hasBackgroundImage ? '' : 'bg-white'}`}
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

							<div className='relative z-10 mx-auto flex min-h-full max-w-[680px] flex-col items-center justify-center text-center'>
								<img
									src='/logo.png'
									alt='Pure Tide Advanced Peptide Wellness'
									className='w-[60px] drop-shadow-[0_8px_18px_rgba(0,0,0,0.18)] sm:w-[80px] brightness-0 invert'
								/>

								<div className='mt-2 sm:mt-5'>
									<h2
										className={`font-black uppercase leading-[0.86] tracking-[-0.06em] text-[clamp(1.5rem,6vw,3rem)] sm:text-[clamp(2rem,7vw,4rem)] drop-shadow-[0_6px_18px_rgba(0,0,0,0.18)] ${hasBackgroundImage ? 'text-white' : 'text-[#0b2d3a]'}`}>
										<span className='block'>{primary}</span>
										{accent && <span className='mt-1 block bg-gradient-to-b from-[#31d8df] to-[#16adb9] bg-clip-text text-transparent'>{accent}</span>}
									</h2>
									<div className='mx-auto mt-1 h-[2px] w-12 bg-[#26c8d0] sm:w-16' />
								</div>

								{campaign.message && (
									<p
										className={`mt-2 max-w-[480px] text-[clamp(0.85rem,1.5vw,1.1rem)] font-medium leading-[1.3] drop-shadow ${hasBackgroundImage ? 'text-white/95' : 'text-[#0b2d3a]/80'}`}>
										{campaign.message}
									</p>
								)}
								{campaign.subtitle && (
									<p className={`mt-0.5 text-xs font-semibold uppercase tracking-[0.22em] ${hasBackgroundImage ? 'text-cyan-200/85' : 'text-[#168c96]'}`}>
										{campaign.subtitle}
									</p>
								)}

								<div
									className={`mt-2 w-full rounded-[14px] border border-[#26c8d0]/70 px-2 py-1.5 shadow-[inset_0_0_32px_rgba(30,199,215,0.08),0_14px_42px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:px-4 sm:py-2.5 ${hasBackgroundImage ? 'bg-[#041b2d]/62' : 'bg-white'}`}>
									{campaign.tiers.map((tier, index) => (
										<div
											key={`${tier.promoCode}-${tier.minimumOrderAmount}`}
											className={`flex flex-col items-center gap-1.5 py-2 text-center sm:grid sm:grid-cols-[28px_minmax(70px,0.75fr)_28px_minmax(100px,1fr)_minmax(100px,0.9fr)] sm:items-center sm:gap-2.5 sm:py-2.5 sm:text-left ${index > 0 ? 'border-t border-cyan-200/35' : ''}`}>
											<img
												src='/logo.png'
												alt='Pure Tide'
												className='h-8 w-auto brightness-0 invert sm:h-6 sm:w-9'
											/>
											<div className='flex flex-col items-center gap-1 sm:hidden'>
												<div className={`text-lg font-black tracking-[-0.04em] ${hasBackgroundImage ? 'text-white' : 'text-[#0b2d3a]'}`}>
													{formatCurrency(tier.minimumOrderAmount)}
												</div>
												<div className='text-sm font-black uppercase tracking-[-0.04em] text-[#23c5cf]'>SAVE {tier.discountPercentage}%</div>
												<div className={`text-sm font-semibold ${hasBackgroundImage ? 'text-white' : 'text-[#0b2d3a]'}`}>
													<span className={`text-xs font-normal ${hasBackgroundImage ? 'text-white/95' : 'text-[#0b2d3a]/80'}`}>Code: </span>
													<span className='font-black text-[#23c5cf]'>{tier.promoCode}</span>
												</div>
											</div>
											<div className={`hidden sm:block text-lg font-black tracking-[-0.04em] sm:text-xl ${hasBackgroundImage ? 'text-white' : 'text-[#0b2d3a]'}`}>
												{formatCurrency(tier.minimumOrderAmount)}
											</div>
											<div className='hidden sm:block text-xl font-light text-[#23c5cf] sm:text-2xl'>→</div>
											<div className='hidden sm:block text-sm font-black uppercase tracking-[-0.04em] text-[#23c5cf] sm:text-lg'>SAVE {tier.discountPercentage}%</div>
											<div className={`hidden sm:block col-span-1 text-xs font-semibold sm:text-sm ${hasBackgroundImage ? 'text-white' : 'text-[#0b2d3a]'}`}>
												<span className={`font-normal ${hasBackgroundImage ? 'text-white/95' : 'text-[#0b2d3a]/80'}`}>(code: </span>
												<span className='font-black text-[#23c5cf]'>{tier.promoCode}</span>
												<span className={`font-normal ${hasBackgroundImage ? 'text-white/95' : 'text-[#0b2d3a]/80'}`}>)</span>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
