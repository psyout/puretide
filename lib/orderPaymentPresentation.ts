export type OrderPaymentPresentationInput = {
	paymentMethod?: 'etransfer' | 'creditcard';
	paymentPath?: 'manual' | 'bluepeak' | 'manual_friends_family';
	depositEmail?: string;
};

export type OrderPaymentPresentation = {
	customerType: 'Family & Friends' | 'Regular Customer';
	method: 'Credit card' | 'Interac e-Transfer';
	displayLabel: string;
	pipeline?: 'Manual Interac' | 'BluePeak';
	paymentRecipientEmail?: string;
};

const MANUAL_ETRANSFER_EMAIL = 'orders@puretide.ca';

export function getOrderPaymentPresentation(input: OrderPaymentPresentationInput): OrderPaymentPresentation {
	if (input.paymentMethod === 'creditcard') {
		return {
			customerType: 'Regular Customer',
			method: 'Credit card',
			displayLabel: 'Credit card',
		};
	}

	if (input.paymentPath === 'manual_friends_family') {
		return {
			customerType: 'Family & Friends',
			method: 'Interac e-Transfer',
			displayLabel: 'Interac e-Transfer — Family & Friends',
			pipeline: 'Manual Interac',
			paymentRecipientEmail: MANUAL_ETRANSFER_EMAIL,
		};
	}

	if (input.paymentPath === 'bluepeak') {
		const depositEmail = input.depositEmail?.trim();
		return {
			customerType: 'Regular Customer',
			method: 'Interac e-Transfer',
			displayLabel: 'Interac e-Transfer — BluePeak',
			pipeline: 'BluePeak',
			paymentRecipientEmail: depositEmail || undefined,
		};
	}

	return {
		customerType: 'Regular Customer',
		method: 'Interac e-Transfer',
		displayLabel: 'Interac e-Transfer',
		pipeline: 'Manual Interac',
		paymentRecipientEmail: MANUAL_ETRANSFER_EMAIL,
	};
}
