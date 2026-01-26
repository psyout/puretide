import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';

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
			</head>
			<body className={`${matimo.variable} antialiased`}>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
