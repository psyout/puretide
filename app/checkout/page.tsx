import CheckoutClient from '@/components/CheckoutClient';
import PromoBannerWrapper from '@/components/PromoBannerWrapper';
import { creditCardPaymentsEnabled } from '@/lib/creditCardAvailability';

export const dynamic = 'force-dynamic';

export default function CheckoutPage() {
	const promoBannerEnabled = String(process.env.NEXT_PUBLIC_PROMO_BANNER_ENABLED ?? '').toLowerCase() === 'true';

	return (
		<>
			<PromoBannerWrapper
				enabled={promoBannerEnabled}
				message={process.env.NEXT_PUBLIC_PROMO_BANNER_MESSAGE}
				cta={process.env.NEXT_PUBLIC_PROMO_BANNER_CTA}
			/>
			<CheckoutClient enableCreditCard={creditCardPaymentsEnabled()} />
		</>
	);
}
