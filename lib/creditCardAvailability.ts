// The Gatewaylinx hosted flow and final-outcome handling have passed test-mode checks.
// Production creation still verifies that CARD_PAYMENTS_KEY belongs to a live account.
export const CREDIT_CARD_PAYMENTS_PAUSED = false;

/** Read on the server at request time; the browser receives this through checkout props. */
export function creditCardPaymentsEnabled(): boolean {
	const flag = 'NEXT_PUBLIC_ENABLE_CREDIT_CARD';
	return (!CREDIT_CARD_PAYMENTS_PAUSED || (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_CARD_TEST_MODE === 'true')) &&
		process.env[flag] === 'true';
}
