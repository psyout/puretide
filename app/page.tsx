import ProductGrid from '@/components/ProductGrid';
import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import About from '@/components/About';
import Contact from '@/components/Contact';
import PromotionModal from '@/components/PromotionModal';
import PromoBannerWrapper from '@/components/PromoBannerWrapper';
import { getCachedActivePromotionCampaign } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
	const promoModalEnabled = String(process.env.PROMO_MODAL_ENABLED ?? '').toLowerCase() === 'true';
	const promoBannerEnabled = String(process.env.NEXT_PUBLIC_PROMO_BANNER_ENABLED ?? '').toLowerCase() === 'true';
	const activePromotion = promoModalEnabled ? await getCachedActivePromotionCampaign() : null;

	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-eucalyptus-50 to-deep-tidal-teal-100'>
			{activePromotion ? <PromotionModal campaign={activePromotion} /> : null}
			<PromoBannerWrapper
				enabled={promoBannerEnabled}
				message={process.env.NEXT_PUBLIC_PROMO_BANNER_MESSAGE}
				cta={process.env.NEXT_PUBLIC_PROMO_BANNER_CTA}
			/>

			<Hero />

			<main>
				<ProductGrid />
			</main>

			<About />

			<Contact />

			<Footer />
		</div>
	);
}
