type OrderEmailInput = {
	orderNumber: string;
	createdAt: string;
	paymentMethod?: 'etransfer' | 'creditcard';
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
	shippingMethod: 'regular' | 'express';
	subtotal: number;
	shippingCost: number;
	discountAmount?: number;
	promoCode?: string;
	total: number;
	cartItems: Array<{
		id: number;
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

export function buildOrderEmails(input: OrderEmailInput): OrderEmailResult {
	const isCreditCard = input.paymentMethod === 'creditcard';
	const orderDate = formatDate(input.createdAt);
	const orderName = `${input.customer.firstName} ${input.customer.lastName}`.trim();
	const shippingLabel = input.shippingMethod === 'express' ? 'Express Shipping' : 'Regular Shipping';
	const paymentMethodLabel = isCreditCard ? 'Credit card' : 'Interac e-Transfer';
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

	const itemsText = input.cartItems.map((item) => `- ${item.name} x${item.quantity} (${formatMoney(item.price * item.quantity)})`).join('\n');
	const itemsHtml = input.cartItems
		.map(
			(item) => `
              <tr>
                <td style="padding: 6px 0;">${item.name}</td>
                <td style="padding: 6px 0;">x${item.quantity}</td>
                <td style="padding: 6px 0; text-align: right;">${formatMoney(item.price * item.quantity)}</td>
              </tr>
            `,
		)
		.join('');

	const customerIntro = isCreditCard ? 'Thank you for your order. Your credit card payment has been received.' : 'We have received your order and it is on hold until payment is confirmed.';

	const eTransferInstructionsText = [
		'',
		'Interac e-Transfer Instructions',
		'',
		'After placing your order, please send an Interac e-Transfer following the instructions below. Enter everything exactly as shown so your payment is automatically accepted.',
		'',
		`Recipient Name: ${paymentDetails.recipientName}`,
		`Recipient Email: ${paymentDetails.recipientEmail}`,
		'',
		'We only accept e-Transfers sent to the email listed above. Do not send payments to any other email address.',
		'',
		'If your payment is not accepted, please go to your banking app, cancel and re-send with correct instructions above.',
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
		...(isCreditCard ? [] : eTransferInstructionsText),
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

	const eTransferBlockHtml = isCreditCard
		? ''
		: `
      <h4 style="margin: 24px 0 8px;">Interac e-Transfer Instructions</h4>
      <p>After placing your order, please send an Interac e-Transfer following the instructions below. Enter everything exactly as shown so your payment is automatically accepted.</p>
      <ul>
        <li><strong>Recipient Name:</strong> ${paymentDetails.recipientName}</li>
        <li><strong>Recipient Email:</strong> ${paymentDetails.recipientEmail}</li>
      </ul>
      <p>We only accept e-Transfers sent to the email listed above. Do not send payments to any other email address.</p>
      <p>If your payment is not accepted, please go to your banking app, cancel and re-send with correct instructions above.</p>
      <p><strong>Email notice:</strong> If you do not see future updates, please check your junk/spam folder and add us to your contacts or safe sender list.</p>
      <p>Should you encounter any payment related issues, please contact our support at: <strong>${paymentDetails.supportEmail}</strong></p>
  `;

	const customerHtml = `
    <div style="font-family: Arial, sans-serif; color: #0b3f3c; line-height: 1.5;">
      <h2 style="margin: 0 0 8px;">Pure Tide</h2>
      <h3 style="margin: 0 0 16px;">Thank you for your order</h3>
      <p>Hi ${input.customer.firstName},</p>
      <p>${customerIntro}</p>
      ${eTransferBlockHtml}

      <h4 style="margin: 24px 0 8px;">Order summary</h4>
      <p><strong>Order #${input.orderNumber}</strong> (${orderDate})</p>
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
      ${input.discountAmount ? `<p><strong>Discount (${input.promoCode ?? 'promo'}):</strong> -${formatMoney(input.discountAmount)}</p>` : ''}
      <p><strong>Shipping:</strong> ${shippingLabel} ${formatMoney(input.shippingCost)}</p>
      <p><strong>Total:</strong> ${formatMoney(input.total)}</p>
      <p><strong>Payment method:</strong> ${paymentMethodLabel}</p>

      <h4 style="margin: 24px 0 8px;">Billing address</h4>
      <p>${billingLines.join('<br />')}</p>
      <h4 style="margin: 16px 0 8px;">Shipping address</h4>
      <p>${shippingLines.join('<br />')}</p>

      <p style="margin-top: 24px;">Thanks again! If you need any help with your order, please contact us at ${paymentDetails.supportEmail}.</p>
    </div>
  `;

	const adminETransferBlock = ['', 'Interac e-Transfer details', `Recipient Name: ${paymentDetails.recipientName}`, `Recipient Email: ${paymentDetails.recipientEmail}`];

	const adminText = [
		'New order received',
		`Order #${input.orderNumber} (${orderDate})`,
		'',
		'Customer',
		...billingLines,
		'',
		'Shipping address',
		...shippingLines,
		'',
		'Products',
		itemsText,
		'',
		`Subtotal: ${formatMoney(input.subtotal)}`,
		input.discountAmount ? `Discount (${input.promoCode ?? 'promo'}): -${formatMoney(input.discountAmount)}` : null,
		`Shipping: ${shippingLabel} ${formatMoney(input.shippingCost)}`,
		`Total: ${formatMoney(input.total)}`,
		`Payment method: ${paymentMethodLabel}`,
		...(isCreditCard ? [] : adminETransferBlock),
		adminNotes ? '' : null,
		adminNotes ? 'Order notes' : null,
		adminNotes ? adminNotes : null,
	]
		.filter(Boolean)
		.join('\n');

	const adminHtml = `
    <div style="font-family: Arial, sans-serif; color: #0b3f3c; line-height: 1.5;">
      <h2 style="margin: 0 0 8px;">New order received</h2>
      <p><strong>Order #${input.orderNumber}</strong> (${orderDate})</p>

      <h4 style="margin: 24px 0 8px;">Customer</h4>
      <p>${billingLines.join('<br />')}</p>

      <h4 style="margin: 16px 0 8px;">Shipping address</h4>
      <p>${shippingLines.join('<br />')}</p>

      <h4 style="margin: 24px 0 8px;">Products</h4>
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
      ${input.discountAmount ? `<p><strong>Discount (${input.promoCode ?? 'promo'}):</strong> -${formatMoney(input.discountAmount)}</p>` : ''}
      <p><strong>Shipping:</strong> ${shippingLabel} ${formatMoney(input.shippingCost)}</p>
      <p><strong>Total:</strong> ${formatMoney(input.total)}</p>
      <p><strong>Payment method:</strong> ${paymentMethodLabel}</p>
      ${
			isCreditCard
				? ''
				: `
      <h4 style="margin: 24px 0 8px;">Interac e-Transfer details</h4>
      <ul>
        <li><strong>Recipient Name:</strong> ${paymentDetails.recipientName}</li>
        <li><strong>Recipient Email:</strong> ${paymentDetails.recipientEmail}</li>
      </ul>
      `
		}
      ${adminNotes ? `<h4 style="margin: 24px 0 8px;">Order notes</h4><p>${adminNotes}</p>` : ''}
    </div>
  `;

	const customerSubject = isCreditCard ? `Order #${input.orderNumber} - Order confirmation` : `Order #${input.orderNumber} - Interac e-Transfer instructions`;

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
