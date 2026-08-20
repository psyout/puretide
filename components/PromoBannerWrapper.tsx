'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import PromoBanner from './PromoBanner';
import EmailCaptureModal from './EmailCaptureModal';
import Header from './Header';
import { useScrollDirection } from '@/lib/useScrollDirection';

const PROMO_BANNER_SUBSCRIBED_KEY = 'promo-banner-subscribed';

interface PromoBannerWrapperProps {
	enabled?: boolean;
	message?: string;
	cta?: string;
}

export default function PromoBannerWrapper({ enabled = false, message, cta }: PromoBannerWrapperProps) {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const ctaButtonRef = useRef<HTMLButtonElement>(null);
	const topStackRef = useRef<HTMLDivElement>(null);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [collapsePending, setCollapsePending] = useState(false);
	const [isMounted, setIsMounted] = useState(false);
	const isScrollingUp = useScrollDirection();

	useEffect(() => {
		setIsMounted(true);
		const subscribed = localStorage.getItem(PROMO_BANNER_SUBSCRIBED_KEY);
		setIsCollapsed(subscribed === 'true');
	}, []);

	useEffect(() => {
		if (!isMounted || !topStackRef.current) return;

		const topStack = topStackRef.current;
		const updateHeaderHeight = () => {
			document.documentElement.style.setProperty('--site-header-height', `${Math.ceil(topStack.getBoundingClientRect().height)}px`);
		};

		updateHeaderHeight();
		const resizeObserver = new ResizeObserver(updateHeaderHeight);
		resizeObserver.observe(topStack);
		window.addEventListener('resize', updateHeaderHeight);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', updateHeaderHeight);
		};
	}, [enabled, isCollapsed, isMounted]);

	if (!isMounted) {
		return <Header />;
	}

	return (
		<>
			<div
				ref={topStackRef}
				className={`fixed top-0 left-0 right-0 z-[120] transform transition-[opacity,transform] duration-500 ease-out ${isScrollingUp ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-full opacity-0 pointer-events-none'}`}>
				{enabled && !isCollapsed ? (
					<>
						<AnimatePresence>
							<PromoBanner
								messages={message ? [message] : undefined}
								cta={cta}
								ctaButtonRef={ctaButtonRef}
								onCtaClick={() => setIsModalOpen(true)}
							/>
						</AnimatePresence>
						<Header stacked />
					</>
				) : (
					<Header />
				)}
			</div>
			<EmailCaptureModal
				isOpen={isModalOpen}
				onClose={() => {
					setIsModalOpen(false);
					if (collapsePending) {
						setIsCollapsed(true);
						setCollapsePending(false);
					}
				}}
				triggerRef={ctaButtonRef}
				onSuccess={() => {
					localStorage.setItem(PROMO_BANNER_SUBSCRIBED_KEY, 'true');
					setCollapsePending(true);
				}}
			/>
		</>
	);
}
