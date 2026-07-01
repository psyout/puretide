export type PromoVerifyResponse = { ok?: boolean; discount?: number; freeShipping?: boolean; error?: string };

export type AppliedPromoState = {
	appliedPromoCode: string | null;
	appliedDiscount: number;
	appliedFreeShipping: boolean;
	promoError: string | null;
};

export function applyPromoVerifyResponse(params: { code: string; response: PromoVerifyResponse }): AppliedPromoState {
	const normalizedCode = params.code.trim().toUpperCase();
	const response = params.response;
	if (response.ok) {
		return {
			appliedPromoCode: normalizedCode,
			appliedDiscount: Number(response.discount ?? 0),
			appliedFreeShipping: Boolean(response.freeShipping),
			promoError: null,
		};
	}
	return {
		appliedPromoCode: null,
		appliedDiscount: 0,
		appliedFreeShipping: false,
		promoError: response.error || 'Invalid code',
	};
}
