import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Providers } from './providers';
import OrderAttributionConsent from '@/components/OrderAttributionConsent';
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
	const attributionQaEnabled = String(process.env.ATTRIBUTION_ENABLED ?? '').toLowerCase() === 'true' && process.env.ATTRIBUTION_ENVIRONMENT === 'qa';
	const attributionParameter = process.env.ATTRIBUTION_PUBLIC_QUERY_PARAMETER ?? 'binom_click_id';
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
				{attributionQaEnabled ? (
					<Suspense fallback={null}>
						<OrderAttributionConsent publicParameter={attributionParameter} />
					</Suspense>
				) : null}
				<Providers automaticPromotion={automaticPromotion}>{children}</Providers>
				<Footer />
			</body>
		</html>
	);
}
