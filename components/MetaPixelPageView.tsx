'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

declare global {
	interface Window {
		fbq?: (...args: any[]) => void;
	}
}

export default function MetaPixelPageView() {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	useEffect(() => {
		try {
			if (!window.fbq) return;
			window.fbq('track', 'PageView');
		} catch (e) {
			// Facebook Pixel tracking failed
			const errorMessage = e instanceof Error ? e.message : 'Unknown error';
			console.log('Facebook Pixel PageView tracking failed:', errorMessage);
		}
	}, [pathname, searchParams]);

	return null;
}
