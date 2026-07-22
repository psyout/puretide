'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import PromoBanner from './PromoBanner';
import EmailCaptureModal from './EmailCaptureModal';
import Header from './Header';

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
	const [topStackHeight, setTopStackHeight] = useState(0);
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [collapsePending, setCollapsePending] = useState(false);
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
		const subscribed = localStorage.getItem(PROMO_BANNER_SUBSCRIBED_KEY);
		setIsCollapsed(subscribed === 'true');
	}, []);

	useEffect(() => {
		if (!enabled || isCollapsed) return;
		if (!topStackRef.current) return;

		const el = topStackRef.current;
		const ro = new ResizeObserver(() => {
			setTopStackHeight(el.offsetHeight);
		});
		ro.observe(el);
		setTopStackHeight(el.offsetHeight);
		return () => ro.disconnect();
	}, [enabled, isCollapsed]);

	useEffect(() => {
		if (!enabled || isCollapsed) return;
		document.documentElement.style.setProperty('--top-stack-height', `${topStackHeight}px`);
		return () => {
			document.documentElement.style.setProperty('--top-stack-height', '0px');
		};
	}, [enabled, isCollapsed, topStackHeight]);

	if (!enabled || !isMounted || (isCollapsed && !isModalOpen)) {
		return <Header />;
	}

	return (
		<>
			<div
				style={{ height: topStackHeight }}
				className='shrink-0'
			/>
			<div
				ref={topStackRef}
				className='fixed top-0 left-0 right-0 z-[120]'>
				<AnimatePresence>
					<PromoBanner
						messages={message ? [message] : undefined}
						cta={cta}
						ctaButtonRef={ctaButtonRef}
						onCtaClick={() => setIsModalOpen(true)}
					/>
				</AnimatePresence>
				<Header stacked />
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
