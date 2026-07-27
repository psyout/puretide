'use client';

import { useEffect, useState } from 'react';

export function useStickyUntilSection(sectionId: string, topOffset = 0) {
	const [isSticky, setIsSticky] = useState(true);

	useEffect(() => {
		const section = document.getElementById(sectionId);
		if (!section) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsSticky(true);
					return;
				}

				const viewportBottom = entry.rootBounds?.bottom ?? window.innerHeight;
				setIsSticky(entry.boundingClientRect.top > viewportBottom);
			},
			{
				rootMargin: `-${topOffset}px 0px 0px 0px`,
				threshold: 0,
			},
		);

		observer.observe(section);
		return () => observer.disconnect();
	}, [sectionId, topOffset]);

	return isSticky;
}
