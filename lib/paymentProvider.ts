export type CreditCardProvider = 'digipay' | 'gatewaylinx';

export type PaymentResult = {
	ok: boolean;
	orderNumber: string;
	amountReceived?: number;
	transactionId?: string;
	rawStatus?: string;
};

export type CreatePaymentSessionResult = {
	redirectUrl: string;
	orderNumber: string;
};

export interface PaymentProvider {
	createPaymentSession(payload: unknown): Promise<CreatePaymentSessionResult>;
	validatePaymentNotification(request: Request): Promise<PaymentResult>;
}

export function getCreditCardProvider(): CreditCardProvider {
	const raw = process.env.CREDIT_CARD_PROVIDER;
	if (raw === 'gatewaylinx') return 'gatewaylinx';
	return 'digipay';
}

export function getPaymentProvider(): PaymentProvider {
	const provider = getCreditCardProvider();

	if (provider === 'gatewaylinx') {
		throw new Error('Gatewaylinx provider not implemented yet');
	}

	// Lazy import to avoid pulling DigiPay dependencies unless used.
	// Also keeps this module stable even if DigiPay internals change.
	const { DigipayProvider } = require('./providers/digipayProvider') as {
		DigipayProvider: new () => PaymentProvider;
	};
	return new DigipayProvider();
}
