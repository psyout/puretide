import type { CardPayment } from './cardPaymentsApi';

export type CardPaymentDecision = 'paid' | 'failed' | 'pending' | 'review';

/** Only an exact, final paid match may release an order for fulfillment. */
export function decideCardPayment(payment: CardPayment, orderNumber: string, amountMinor: number): CardPaymentDecision {
	if (payment.reference !== orderNumber || payment.amount?.amount_minor !== amountMinor || payment.amount?.currency !== 'CAD' || payment.amount_matches === false) {
		return 'review';
	}
	if (payment.outcome === 'paid') return payment.final === true ? 'paid' : 'pending';
	if (payment.outcome === 'failed') {
		if (payment.status === 'canceled') return 'review';
		return payment.final === true ? 'failed' : 'pending';
	}
	if (payment.outcome === 'in_progress' && payment.final === false) return 'pending';
	return 'review';
}
