'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import PromoBanner from './PromoBanner';
import EmailCaptureModal from './EmailCaptureModal';
import Header from './Header';
import { useStickyUntilSection } from '@/lib/useStickyUntilSection';

const PROMO_BANNER_SUBSCRIBED_KEY = 'promo-banner-subscribed';

interface PromoBannerWrapperProps {
	enabled?: boolean;
	message?: string;
	cta?: string;
	stickyBoundaryId?: string;
}

export default function PromoBannerWrapper({ enabled = false, message, cta, stickyBoundaryId = 'products-sticky-boundary' }: PromoBannerWrapperProps) {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const ctaButtonRef = useRef<HTMLButtonElement>(null);
	const topStackRef = useRef<HTMLDivElement>(null);
	const [topStackHeight, setTopStackHeight] = useState(0);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [collapsePending, setCollapsePending] = useState(false);
	const [isMounted, setIsMounted] = useState(false);
	const isSticky = useStickyUntilSection(stickyBoundaryId, topStackHeight);

	useEffect(() => {
		setIsMounted(true);
		const subscribed = localStorage.getItem(PROMO_BANNER_SUBSCRIBED_KEY);
		setIsCollapsed(subscribed === 'true');
	}, []);

	useEffect(() => {
		if (!topStackRef.current) return;

		const el = topStackRef.current;
		const ro = new ResizeObserver(() => {
			setTopStackHeight(el.offsetHeight);
		});
		ro.observe(el);
		setTopStackHeight(el.offsetHeight);
		return () => ro.disconnect();
	}, [enabled, isCollapsed, isMounted]);

	useEffect(() => {
		if (!enabled || isCollapsed) return;
		document.documentElement.style.setProperty('--top-stack-height', `${topStackHeight}px`);
		return () => {
			document.documentElement.style.setProperty('--top-stack-height', '0px');
		};
	}, [enabled, isCollapsed, topStackHeight]);

	if (!isMounted) {
		return <Header />;
	}

	return (
		<>
			{enabled && !isCollapsed ? (
				<div
					style={{ height: topStackHeight }}
					className='shrink-0'
				/>
			) : null}
			<div
				ref={topStackRef}
				className={`fixed top-0 left-0 right-0 z-[120] transform transition-[opacity,transform] duration-500 ease-out ${isSticky ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-full opacity-0 pointer-events-none'}`}>
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
