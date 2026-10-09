import CheckoutClient from '@/components/CheckoutClient';
import PromoBannerWrapper from '@/components/PromoBannerWrapper';
import { getCachedAutomaticSitewidePromo } from '@/lib/sheetCache';

export default async function CheckoutPage() {
	const promoBannerEnabled = String(process.env.NEXT_PUBLIC_PROMO_BANNER_ENABLED ?? '').toLowerCase() === 'true';
	const automaticPromotion = await getCachedAutomaticSitewidePromo();

	return (
		<>
			<PromoBannerWrapper
				enabled={promoBannerEnabled}
				message={process.env.NEXT_PUBLIC_PROMO_BANNER_MESSAGE}
				cta={process.env.NEXT_PUBLIC_PROMO_BANNER_CTA}
			/>
			<CheckoutClient automaticPromotion={automaticPromotion} />
		</>
	);
}
