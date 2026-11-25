// Temporary pause while the payment provider's Gatewaylinx tunnel is unavailable.
// Set to false after the provider is verified healthy and redeploy.
export const CREDIT_CARD_PAYMENTS_PAUSED = true;

export const CREDIT_CARD_PAYMENTS_ENABLED =
	!CREDIT_CARD_PAYMENTS_PAUSED && process.env.NEXT_PUBLIC_ENABLE_CREDIT_CARD !== 'false';
