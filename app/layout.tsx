import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Providers } from './providers';
import MetaPixel from '@/components/MetaPixel';
import Footer from '@/components/Footer';
import { getCachedAutomaticSitewidePromo } from '@/lib/sheetCache';

// Promotion pricing comes from Google Sheets and must be evaluated at request
// time. Otherwise Next.js can bake an inactive promotion into static cart and
// checkout pages during deployment.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
	title: 'Pure Tide Wellness - Advanced Peptide Formulations',
	description: 'Advanced peptide formulations for optimal health and wellness, delivered to your doorstep.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const automaticPromotion = await getCachedAutomaticSitewidePromo();
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
			</head>
			<body className='min-h-screen antialiased'>
				<Suspense fallback={null}>
					<MetaPixel />
				</Suspense>
				<Providers automaticPromotion={automaticPromotion}>{children}</Providers>
				<Footer />
			</body>
		</html>
	);
}
