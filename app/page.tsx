import ProductGrid from '@/components/ProductGrid';
import ProductGridAlternative from '@/components/ProductGridAlternative';
import Hero from '@/components/Hero';
import About from '@/components/About';
import AboutAlternative from '@/components/AboutAlternative';
import Contact from '@/components/Contact';
import ContactAlternative from '@/components/ContactAlternative';
import PromotionModal from '@/components/PromotionModal';
import PromoBannerWrapper from '@/components/PromoBannerWrapper';
import { getCachedActivePromotionCampaign } from '@/lib/sheetCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Keep both approaches available while the new About direction is being evaluated.
const USE_ALTERNATIVE_ABOUT = true;
const USE_ALTERNATIVE_CONTACT = true;
const USE_ALTERNATIVE_PRODUCT_GRID = true;

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
				{USE_ALTERNATIVE_PRODUCT_GRID ? <ProductGridAlternative /> : <ProductGrid />}
			</main>

			{USE_ALTERNATIVE_ABOUT ? <AboutAlternative /> : <About />}

			{USE_ALTERNATIVE_CONTACT ? <ContactAlternative /> : <Contact />}

		</div>
	);
}
