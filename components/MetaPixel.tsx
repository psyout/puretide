'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

declare global {
	interface Window {
		fbq?: (...args: unknown[]) => void;
		_fbq?: unknown;
	}
}

export default function MetaPixel() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const initialized = useRef(false);
	const lastPage = useRef('');
	const page = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

	useEffect(() => {
		let cancelled = false;
		void fetch('/api/meta/config', { cache: 'no-store' })
			.then((response) => (response.ok ? response.json() : null))
			.then((config: { enabled?: boolean; pixelId?: string } | null) => {
				if (cancelled || !config?.enabled || !/^\d{5,30}$/.test(config.pixelId ?? '') || initialized.current) return;
				const pixelId = String(config.pixelId);
				const bootstrap = document.createElement('script');
				bootstrap.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`;
				document.head.appendChild(bootstrap);
				bootstrap.remove();
				initialized.current = true;
				lastPage.current = page;
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [page]);

	useEffect(() => {
		if (!initialized.current || lastPage.current === page) return;
		window.fbq?.('track', 'PageView');
		lastPage.current = page;
	}, [page]);

	return null;
}
