'use client';

import { useEffect, useState } from 'react';

export function useScrollDirection() {
	const [isScrollingUp, setIsScrollingUp] = useState(true);
	const [lastScrollY, setLastScrollY] = useState(0);

	useEffect(() => {
		setLastScrollY(window.scrollY);

		const handleScroll = () => {
			const currentScrollY = window.scrollY;
			const direction = currentScrollY > lastScrollY ? 'down' : 'up';
			setIsScrollingUp(direction === 'up');
			setLastScrollY(currentScrollY);
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	}, [lastScrollY]);

	return isScrollingUp;
}
