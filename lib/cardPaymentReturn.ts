import type { CardPayment } from './cardPaymentsApi';

/** A hosted return while the card form is still waiting can resume the saved cart. */
export function shouldReturnToCart(payment: CardPayment, orderNumber: string, savedPaymentId: string): boolean {
	return payment.id === savedPaymentId &&
		payment.reference === orderNumber &&
		payment.status === 'pending_action' &&
		payment.outcome === 'in_progress' &&
		payment.final === false &&
		Array.isArray(payment.attempts) && payment.attempts.every((attempt) => attempt.result === 'pending');
}
