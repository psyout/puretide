import CartClient from '@/components/CartClient';
import PromoBannerWrapper from '@/components/PromoBannerWrapper';

export default function CartPage() {
	const promoBannerEnabled = String(process.env.NEXT_PUBLIC_PROMO_BANNER_ENABLED ?? '').toLowerCase() === 'true';

	return (
		<>
			<PromoBannerWrapper
				enabled={promoBannerEnabled}
				message={process.env.NEXT_PUBLIC_PROMO_BANNER_MESSAGE}
				cta={process.env.NEXT_PUBLIC_PROMO_BANNER_CTA}
				stickyBoundaryId='cart-sticky-boundary'
			/>
			<div id='cart-sticky-boundary'>
				<CartClient />
			</div>
		</>
	);
}
