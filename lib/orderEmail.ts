import { getOrderPaymentPresentation } from '@/lib/orderPaymentPresentation';
import { buildBrandedEmail, emailInfoBox, emailSectionTitle, escapeEmailHtml } from '@/lib/emailTemplate';

type OrderEmailInput = {
	orderNumber: string;
	createdAt: string;
	paymentMethod?: 'etransfer' | 'creditcard';
	paymentConfirmed?: boolean;
	etransferProvider?: 'manual' | 'bluepeak';
	paymentRecipientEmail?: string;
	paymentPath?: 'manual' | 'bluepeak' | 'manual_friends_family';
	customer: {
		firstName: string;
		lastName: string;
		country: string;
		email: string;
		address: string;
		addressLine2: string;
		city: string;
		province: string;
		zipCode: string;
		orderNotes: string;
	};
	shipToDifferentAddress: boolean;
	shippingAddress?: {
		address: string;
		addressLine2: string;
		city: string;
		province: string;
		zipCode: string;
	};
	shippingMethod: 'express';
	subtotal: number;
	shippingCost: number;
	discountAmount?: number;
	promoCode?: string;
	total: number;
	cartItems: Array<{
		id: string | number;
		name: string;
		price: number;
		quantity: number;
	}>;
};

const paymentDetails = {
	recipientName: 'Pure Tide Payments',
	recipientEmail: 'orders@puretide.ca',
	supportEmail: 'info@puretide.ca',
};

const formatMoney = (value: number) =>
	new Intl.NumberFormat('en-CA', {
		style: 'currency',
		currency: 'CAD',
	}).format(value);

const formatDate = (value: string) =>
	new Date(value).toLocaleDateString('en-CA', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});

type OrderEmailPayload = {
	subject: string;
	text: string;
	html: string;
};

type OrderEmailResult = {
	customer: OrderEmailPayload;
	admin: OrderEmailPayload;
};

const escapeHtml = escapeEmailHtml;

export function buildOrderEmails(input: OrderEmailInput): OrderEmailResult {
	const isCreditCard = input.paymentMethod === 'creditcard';
	const paymentConfirmed = Boolean(input.paymentConfirmed);
	const etransferProvider = input.etransferProvider ?? 'manual';
	const isBluepeak = etransferProvider === 'bluepeak';
	const orderDate = formatDate(input.createdAt);
	const orderName = `${input.customer.firstName} ${input.customer.lastName}`.trim();
	const shippingLabel = 'Express Shipping';
	const payment = getOrderPaymentPresentation({
		paymentMethod: input.paymentMethod,
		paymentPath: input.paymentPath,
		depositEmail: input.paymentRecipientEmail,
	});
	const paymentMethodLabel = payment.displayLabel;
	const paymentRecipientEmail = payment.paymentRecipientEmail;
	const billingLines = [
		orderName,
		input.customer.address,
		input.customer.addressLine2,
		`${input.customer.city} ${input.customer.province} ${input.customer.zipCode}`.trim(),
		input.customer.country,
		input.customer.email,
	].filter(Boolean);
	const shippingSource = input.shipToDifferentAddress && input.shippingAddress ? input.shippingAddress : input.customer;
	const shippingLines = [
		orderName,
		shippingSource.address,
		shippingSource.addressLine2,
		`${shippingSource.city} ${shippingSource.province} ${shippingSource.zipCode}`.trim(),
		input.customer.country,
	].filter(Boolean);
	const adminNotes = input.customer.orderNotes?.trim();
	const customerFirstNameHtml = escapeHtml(input.customer.firstName);
	const orderDateHtml = escapeHtml(orderDate);
	const orderNumberHtml = escapeHtml(input.orderNumber);
	const paymentMethodLabelHtml = escapeHtml(paymentMethodLabel);
	const shippingLabelHtml = escapeHtml(shippingLabel);
	const billingLinesHtml = billingLines.map((line) => escapeHtml(line));
	const shippingLinesHtml = shippingLines.map((line) => escapeHtml(line));
	const adminNotesHtml = adminNotes ? escapeHtml(adminNotes) : null;
	const promoCodeHtml = escapeHtml(input.promoCode ?? 'promo');

	const itemsText = input.cartItems.map((item) => `- ${item.name} x${item.quantity} (${formatMoney(item.price * item.quantity)})`).join('\n');
	const itemsHtml = input.cartItems
		.map(
			(item) => `
              <tr>
                <td style="padding: 6px 0;">${escapeHtml(item.name)}</td>
                <td style="padding: 6px 0;">x${item.quantity}</td>
                <td style="padding: 6px 0; text-align: right;">${formatMoney(item.price * item.quantity)}</td>
              </tr>
            `,
		)
		.join('');

	const customerIntro = isCreditCard
		? 'Thank you for your order. Your credit card payment has been received.'
		: paymentConfirmed
			? 'Thank you for your order. We’ve confirmed your Interac e-Transfer payment and your order is now being processed.'
			: 'We have received your order. Please send your Interac e-Transfer to complete payment.';

	const eTransferInstructionsText = [
		'',
		'Interac e-Transfer Payment',
		'',
		'After placing your order, please send an Interac e-Transfer to complete your payment. We use auto-deposit, so funds will be deposited directly into our bank account without requiring a security question.',
		'',
		`Recipient Name: ${paymentDetails.recipientName}`,
		`Recipient Email: ${paymentRecipientEmail ?? paymentDetails.recipientEmail}`,
		`Memo/Message: ${input.orderNumber}`,
		'',
		...(isBluepeak
			? [
					'Note: The recipient email may be our standard payment email or a unique email securely assigned by our payment provider for this order. We do not generate these email addresses — they are used to safely match your Interac e-Transfer to your order. Please send the e-Transfer only to the email shown above and include your order number in the memo/message. Once payment is received and confirmed, you’ll automatically get a payment confirmation email and your order will begin processing.',
					'',
				]
			: []),
		'IMPORTANT: Include your order number in the memo/message field for proper tracking.',
		'We only accept e-Transfers sent to the email listed above. Do not send payments to any other email address.',
		'',
		'Email notice: If you do not see future updates, please check your junk/spam folder and add us to your contacts or safe sender list.',
		'',
		`Should you encounter any payment related issues, please contact our support at: ${paymentDetails.supportEmail}`,
		'',
	];

	const customerText = [
		'Pure Tide',
		'',
		'Thank you for your order',
		`Hi ${input.customer.firstName},`,
		'',
		customerIntro,
		...(isCreditCard || paymentConfirmed ? [] : eTransferInstructionsText),
		'Order summary',
		`Order #${input.orderNumber} (${orderDate})`,
		'',
		'Products',
		itemsText,
		'',
		`Subtotal: ${formatMoney(input.subtotal)}`,
		input.discountAmount ? `Discount (${input.promoCode ?? 'promo'}): -${formatMoney(input.discountAmount)}` : null,
		`Shipping: ${shippingLabel} ${formatMoney(input.shippingCost)}`,
		`Total: ${formatMoney(input.total)}`,
		`Payment method: ${paymentMethodLabel}`,
		'',
		'Billing address',
		...billingLines,
		'',
		'Shipping address',
		...shippingLines,
		'',
		`Thanks again! If you need any help with your order, please contact us at ${paymentDetails.supportEmail}.`,
	]
		.filter(Boolean)
		.join('\n');

	const eTransferBlockHtml =
		isCreditCard || paymentConfirmed
			? ''
			: `
      <h4 style="margin: 24px 0 8px;">Interac e-Transfer Payment</h4>
      <p>After placing your order, please send an Interac e-Transfer to complete your payment. We use auto-deposit, so funds will be deposited directly into our bank account without requiring a security question.</p>
      <ul>
        <li><strong>Recipient Name:</strong> ${paymentDetails.recipientName}</li>
        <li><strong>Recipient Email:</strong> ${escapeHtml(paymentRecipientEmail ?? paymentDetails.recipientEmail)}</li>
        <li><strong>Memo/Message:</strong> ${input.orderNumber}</li>
      </ul>
      ${
			isBluepeak
				? '<p>Note: The recipient email may be our standard payment email or a unique email securely assigned by our payment provider for this order. We do not generate these email addresses — they are used to safely match your Interac e-Transfer to your order. Please send the e-Transfer only to the email shown above and include your order number in the memo/message. Once payment is received and confirmed, you’ll automatically get a payment confirmation email and your order will begin processing.</p>'
				: ''
		}
      <p><strong>Important:</strong> Include your order number in the memo/message field for proper tracking.</p>
      <p>We only accept e-Transfers sent to the email listed above. Do not send payments to any other email address.</p>
      <p><strong>Email notice:</strong> If you do not see future updates, please check your junk/spam folder and add us to your contacts or safe sender list.</p>
      <p>Should you encounter any payment related issues, please contact our support at: <strong>${paymentDetails.supportEmail}</strong></p>
  `;

	const customerHtml = buildBrandedEmail({
		title: isCreditCard ? 'Order confirmed' : paymentConfirmed ? 'Payment received' : 'Complete your e-Transfer',
		status: paymentConfirmed || isCreditCard ? 'Order confirmed' : 'Awaiting payment',
		preheader: `Order #${input.orderNumber}`,
		bodyHtml: `
      <p>Hi ${customerFirstNameHtml},</p>
      <p>${customerIntro}</p>
      ${eTransferBlockHtml}

	  ${emailSectionTitle('Order summary')}
      <p><strong>Order #${orderNumberHtml}</strong> (${orderDateHtml})</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 6px 0; border-bottom: 1px solid #cdd9d7;">Product</th>
            <th style="text-align: left; padding: 6px 0; border-bottom: 1px solid #cdd9d7;">Quantity</th>
            <th style="text-align: right; padding: 6px 0; border-bottom: 1px solid #cdd9d7;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <p><strong>Subtotal:</strong> ${formatMoney(input.subtotal)}</p>
      ${input.discountAmount ? `<p><strong>Discount (${promoCodeHtml}):</strong> -${formatMoney(input.discountAmount)}</p>` : ''}
      <p><strong>Shipping:</strong> ${shippingLabelHtml} ${formatMoney(input.shippingCost)}</p>
      <p><strong>Total:</strong> ${formatMoney(input.total)}</p>
      <p><strong>Payment method:</strong> ${paymentMethodLabelHtml}</p>

	  ${emailSectionTitle('Billing address')}
      <p>${billingLinesHtml.join('<br />')}</p>
	  ${emailSectionTitle('Shipping address')}
      <p>${shippingLinesHtml.join('<br />')}</p>

      <p style="margin-top: 24px;">Thanks again! If you need any help with your order, please contact us at ${paymentDetails.supportEmail}.</p>
	  `,
	});

	const adminETransferBlock = [
		'',
		'PAYMENT DETAILS',
		`Status: ${paymentConfirmed ? 'Confirmed' : 'Awaiting payment'}`,
		`Method: ${payment.method}`,
		`${payment.pipeline === 'BluePeak' ? 'Processor' : 'Pipeline'}: ${payment.pipeline}`,
		`Customer type: ${payment.customerType}`,
		...(payment.pipeline === 'Manual Interac' ? ['Auto-deposit: Enabled', 'Security question: Not required'] : []),
	];

	const adminText = [
		`NEW ORDER RECEIVED${paymentConfirmed ? ' — PAYMENT CONFIRMED' : ''}`,
		`Order #${input.orderNumber}`,
		orderDate,
		`Customer type: ${payment.customerType}`,
		'',
		'SHIPPING ADDRESS',
		...shippingLines,
		'',
		'CUSTOMER',
		orderName,
		input.customer.email,
		'',
		'PRODUCTS',
		itemsText,
		'',
		'ORDER SUMMARY',
		`Subtotal: ${formatMoney(input.subtotal)}`,
		input.discountAmount ? `Discount (${input.promoCode ?? 'promo'}): -${formatMoney(input.discountAmount)}` : null,
		`Shipping: ${shippingLabel} ${formatMoney(input.shippingCost)}`,
		`Total: ${formatMoney(input.total)}`,
		...(isCreditCard ? [] : adminETransferBlock),
		adminNotes ? '' : null,
		adminNotes ? 'Order notes' : null,
		adminNotes ? adminNotes : null,
	]
		.filter(Boolean)
		.join('\n');

	const adminHtml = buildBrandedEmail({
		title: 'New order received',
		headerLabel: 'Operations notification',
		status: paymentConfirmed ? 'Payment confirmed' : 'Awaiting payment',
		preheader: `Order #${input.orderNumber} from ${orderName}`,
		bodyHtml: `
	  <div style="margin-bottom: 20px;">
        <p style="margin: 10px 0 2px;"><strong>Order #${orderNumberHtml}</strong></p>
        <p style="margin: 0;">${orderDateHtml}<br /><strong>Customer type:</strong> ${escapeHtml(payment.customerType)}</p>
      </div>

	  ${emailInfoBox(`
		<h3 style="margin:0 0 12px;color:#1e5260;font-size:16px">Shipping address</h3>
        <p style="margin: 0; font-size: 16px; font-weight: 500; line-height: 1.6;">${shippingLinesHtml.join('<br />')}</p>
	  `, true)}

	  ${emailSectionTitle('Customer')}
      <p style="margin: 0;">${escapeHtml(orderName)}<br /><a href="mailto:${escapeHtml(input.customer.email)}" style="color: #0b6b66;">${escapeHtml(input.customer.email)}</a></p>

	  ${emailSectionTitle('Products')}
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 6px 0; border-bottom: 1px solid #cdd9d7;">Product</th>
            <th style="text-align: left; padding: 6px 0; border-bottom: 1px solid #cdd9d7;">Quantity</th>
            <th style="text-align: right; padding: 6px 0; border-bottom: 1px solid #cdd9d7;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
	  ${emailInfoBox(`<div>
        <h3 style="margin: 0 0 10px; font-size: 16px;">Order summary</h3>
        <p style="margin: 4px 0;"><strong>Subtotal:</strong> ${formatMoney(input.subtotal)}</p>
        ${input.discountAmount ? `<p style="margin: 4px 0;"><strong>Discount (${promoCodeHtml}):</strong> -${formatMoney(input.discountAmount)}</p>` : ''}
        <p style="margin: 4px 0;"><strong>Shipping:</strong> ${shippingLabelHtml} ${formatMoney(input.shippingCost)}</p>
        <p style="margin: 10px 0 0; padding-top: 10px; border-top: 1px solid #cdd9d7; font-size: 18px;"><strong>Total: ${formatMoney(input.total)}</strong></p>
	  </div>`)}
      ${
			isCreditCard
				? `<div style="margin-top: 20px;"><h3 style="margin: 0 0 10px; font-size: 16px;">Payment details</h3><p><strong>Status:</strong> ${paymentConfirmed ? 'Confirmed' : 'Awaiting payment'}<br /><strong>Method:</strong> ${paymentMethodLabelHtml}<br /><strong>Customer type:</strong> ${escapeHtml(payment.customerType)}</p></div>`
				: `
      <div style="margin-top: 20px; padding: 14px 16px; border: 1px solid #cdd9d7; border-radius: 8px;">
        <h3 style="margin: 0 0 10px; font-size: 16px;">Payment details</h3>
        <p style="margin: 0; line-height: 1.7;">
          <strong>Status:</strong> ${paymentConfirmed ? 'Confirmed' : 'Awaiting payment'}<br />
          <strong>Method:</strong> ${escapeHtml(payment.method)}<br />
          <strong>${payment.pipeline === 'BluePeak' ? 'Processor' : 'Pipeline'}:</strong> ${escapeHtml(payment.pipeline ?? '')}<br />
          <strong>Customer type:</strong> ${escapeHtml(payment.customerType)}<br />
		  ${payment.pipeline === 'Manual Interac' ? '<strong>Auto-deposit:</strong> Enabled<br /><strong>Security question:</strong> Not required' : ''}
        </p>
      </div>
      `
		}
      ${adminNotesHtml ? `<h4 style="margin: 24px 0 8px;">Order notes</h4><p>${adminNotesHtml}</p>` : ''}
	  `,
	});

	const customerSubject = isCreditCard
		? `Order #${input.orderNumber} - Order confirmation`
		: paymentConfirmed
			? `Order #${input.orderNumber} - Payment received`
			: `Order #${input.orderNumber} - e-Transfer payment instructions`;

	return {
		customer: {
			subject: customerSubject,
			text: customerText,
			html: customerHtml,
		},
		admin: {
			subject: `New order #${input.orderNumber}`,
			text: adminText,
			html: adminHtml,
		},
	};
}
