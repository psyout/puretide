import type { CreatePaymentSessionResult, PaymentProvider, PaymentResult } from '../paymentProvider';

export class DigipayProvider implements PaymentProvider {
	async createPaymentSession(_payload: unknown): Promise<CreatePaymentSessionResult> {
		throw new Error('DigipayProvider.createPaymentSession is not wired yet. Use the legacy /api/digipay/create endpoint.');
	}

	async validatePaymentNotification(_request: Request): Promise<PaymentResult> {
		throw new Error(
			'DigipayProvider.validatePaymentNotification is not wired yet. Use the legacy /api/digipay/postback endpoint.',
		);
	}
}
