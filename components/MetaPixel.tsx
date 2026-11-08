'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

declare global {
	interface Window {
		fbq?: (...args: unknown[]) => void;
		_fbq?: unknown;
	}
}

export default function MetaPixel({ pixelId }: { pixelId: string }) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const firstPage = useRef(true);
	const page = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

	useEffect(() => {
		if (firstPage.current) {
			firstPage.current = false;
			return;
		}
		window.fbq?.('track', 'PageView');
	}, [page]);

	return (
		<Script
			id='meta-pixel'
			strategy='afterInteractive'
			dangerouslySetInnerHTML={{
				__html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`,
			}}
		/>
	);
}
