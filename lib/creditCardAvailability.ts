// Keep checkout paused until the new Gatewaylinx API flow is tested with a live key.
// Change only after the hosted flow, final-outcome handling, and background polling are verified.
export const CREDIT_CARD_PAYMENTS_PAUSED = true;

export const CREDIT_CARD_PAYMENTS_ENABLED =
	(!CREDIT_CARD_PAYMENTS_PAUSED || (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_CARD_TEST_MODE === 'true')) &&
	process.env.NEXT_PUBLIC_ENABLE_CREDIT_CARD !== 'false';
