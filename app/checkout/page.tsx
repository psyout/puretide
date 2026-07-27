import CheckoutClient from '@/components/CheckoutClient';
import PromoBannerWrapper from '@/components/PromoBannerWrapper';

export default function CheckoutPage() {
	const promoBannerEnabled = String(process.env.NEXT_PUBLIC_PROMO_BANNER_ENABLED ?? '').toLowerCase() === 'true';

	return (
		<>
			<PromoBannerWrapper
				enabled={promoBannerEnabled}
				message={process.env.NEXT_PUBLIC_PROMO_BANNER_MESSAGE}
				cta={process.env.NEXT_PUBLIC_PROMO_BANNER_CTA}
				stickyBoundaryId='checkout-sticky-boundary'
			/>
			<div id='checkout-sticky-boundary'>
				<CheckoutClient />
			</div>
		</>
	);
}
