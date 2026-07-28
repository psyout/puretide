'use client';

import { useEffect, useState } from 'react';

export function useScrollDirection() {
	const [isScrollingUp, setIsScrollingUp] = useState(true);
	const [lastScrollY, setLastScrollY] = useState(0);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const m = window.matchMedia('(max-width: 768px)');
		setIsMobile(m.matches);
		const fn = () => setIsMobile(m.matches);
		m.addEventListener('change', fn);
		return () => m.removeEventListener('change', fn);
	}, []);

	useEffect(() => {
		if (isMobile) {
			setIsScrollingUp(true);
			return;
		}

		setLastScrollY(window.scrollY);

		const handleScroll = () => {
			const currentScrollY = window.scrollY;
			const direction = currentScrollY > lastScrollY ? 'down' : 'up';
			setIsScrollingUp(direction === 'up');
			setLastScrollY(currentScrollY);
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	}, [lastScrollY, isMobile]);

	return isScrollingUp;
}
