import type { Metadata } from 'next';
import { Suspense } from 'react';
import localFont from 'next/font/local';
import Script from 'next/script';
import './globals.css';
import { Providers } from './providers';
import MetaPixelPageView from '@/components/MetaPixelPageView';

export const metadata: Metadata = {
	title: 'Pure Tide Wellness - Advanced Peptide Formulations',
	description: 'Advanced peptide formulations for optimal health and wellness, delivered to your doorstep.',
};

const matimo = localFont({
	src: [
		{
			path: '../public/fonts/matimo-regular-webfont.woff2',
			weight: '400',
			style: 'normal',
		},
		{
			path: '../public/fonts/matimo-medium-webfont.woff2',
			weight: '500',
			style: 'normal',
		},
		{
			path: '../public/fonts/matimo-semibold-webfont.woff2',
			weight: '600',
			style: 'normal',
		},
		{
			path: '../public/fonts/matimo-bold-webfont.woff2',
			weight: '700',
			style: 'normal',
		},
	],
	variable: '--font-matimo',
	display: 'swap',
});

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang='en'>
			<head>
				{/* Privacy-focused: No external tracking scripts */}
				<meta
					name='viewport'
					content='width=device-width, initial-scale=1'
				/>
				<meta
					httpEquiv='X-UA-Compatible'
					content='IE=edge'
				/>
				{/* Prevent tracking */}
				<meta
					name='referrer'
					content='no-referrer'
				/>
				{/* Block all search engines */}
				<meta
					name='robots'
					content='noindex, nofollow, noarchive, nosnippet, noimageindex'
				/>
				<meta
					name='googlebot'
					content='noindex, nofollow, noarchive, nosnippet, noimageindex'
				/>
				{/* Meta Pixel Base Script */}
				<Script
					id='meta-pixel'
					strategy='afterInteractive'>
					{`
						!function(f,b,e,v,n,t,s)
						{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
						n.callMethod.apply(n,arguments):n.queue.push(arguments)};
						if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
						n.queue=[];t=b.createElement(e);t.async=!0;
						t.src=v;s=b.getElementsByTagName(e)[0];
						s.parentNode.insertBefore(t,s)}(window, document,'script',
						'https://connect.facebook.net/en_US/fbevents.js');
						fbq('init', '1594510405130894');
					`}
				</Script>
			</head>
			<body className={`${matimo.variable} antialiased`}>
				{/* Meta Pixel noscript fallback */}
				<noscript>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						height='1'
						width='1'
						style={{ display: 'none' }}
						src='https://www.facebook.com/tr?id=1594510405130894&ev=PageView&noscript=1'
						alt=''
					/>
				</noscript>
				<Suspense fallback={null}>
					<MetaPixelPageView />
				</Suspense>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
