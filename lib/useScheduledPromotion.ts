'use client';

import { useEffect, useState } from 'react';
import type { PromoCode } from '@/types/product';
import { isPromoActive } from '@/lib/promo';

export function useScheduledPromotion(promotion?: PromoCode | null): PromoCode | null {
	const [scheduledPromotion, setScheduledPromotion] = useState<PromoCode | null>(() => (promotion && isPromoActive(promotion) ? promotion : null));

	useEffect(() => {
		const refresh = () => setScheduledPromotion(promotion && isPromoActive(promotion) ? promotion : null);
		refresh();
		const interval = window.setInterval(refresh, 30_000);
		return () => window.clearInterval(interval);
	}, [promotion]);

	return scheduledPromotion;
}
