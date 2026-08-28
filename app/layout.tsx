import type { Metadata } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import './globals.css';
import { Providers } from './providers';
import MetaPixelPageView from '@/components/MetaPixelPageView';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
	title: 'Pure Tide Wellness - Advanced Peptide Formulations',
	description: 'Advanced peptide formulations for optimal health and wellness, delivered to your doorstep.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en'>
			<head>
				<meta
					name='viewport'
					content='width=device-width, initial-scale=1'
				/>
				<meta
					httpEquiv='X-UA-Compatible'
					content='IE=edge'
				/>
				<meta
					name='referrer'
					content='no-referrer'
				/>
				<meta
					name='robots'
					content='noindex, nofollow, noarchive, nosnippet, noimageindex'
				/>
				<meta
					name='googlebot'
					content='noindex, nofollow, noarchive, nosnippet, noimageindex'
				/>

				<Script
					id='meta-pixel'
					strategy='afterInteractive'>
					{`
						!function(f,b,e,v,n,t,s)
						{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
						n.callMethod.apply(n,arguments):n.queue.push(arguments)};
						if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
						n.queue=[];t=b.createElement(e);t.async=!0;
						t.onerror=function() { console.warn('Meta Pixel script failed to load'); };
						t.src=v;s=b.getElementsByTagName(e)[0];
						s.parentNode.insertBefore(t,s)}(window, document,'script',
						'https://connect.facebook.net/en_US/fbevents.js');
						fbq('init', '1594510405130894', {
							// Optional: Add debug mode for development
							debug: window.location.hostname === 'localhost'
						});
					`}
				</Script>
			</head>
			<body className='min-h-screen antialiased'>
				<Suspense fallback={null}>
					<MetaPixelPageView />
				</Suspense>
				<Providers>{children}</Providers>
				<Footer />
			</body>
		</html>
	);
}
