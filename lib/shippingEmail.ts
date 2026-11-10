import { sendMail } from './email';
import { buildBrandedEmail, emailButton, emailInfoBox, emailSectionTitle, escapeEmailHtml } from './emailTemplate';

export interface ShippingConfirmationData {
	orderNumber: string;
	customerEmail: string;
	customerName: string;
	trackingNumber: string;
	shippingMethod: 'express';
	shippingAddress?: { address: string; addressLine2: string; city: string; province: string; zipCode: string };
}

export async function sendShippingConfirmation(data: ShippingConfirmationData) {
	const { orderNumber, customerEmail, customerName, trackingNumber, shippingAddress } = data;
	const shippingLabel = 'Express Shipping';
	const subject = `Pure Tide - Your Order #${orderNumber} Has Shipped!`;
	const customerEmailText = [
		`Dear ${customerName},`, '',
		`Great news! Your Pure Tide order #${orderNumber} has been shipped and is on its way to you.`, '',
		'TRACKING INFORMATION', `Tracking Number: ${trackingNumber} (Canada Post)`, `Shipping Method: ${shippingLabel}`,
		'https://canadapost-postescanada.ca/track',
		...(shippingAddress ? ['', 'DELIVERY ADDRESS', shippingAddress.address, shippingAddress.addressLine2, `${shippingAddress.city}, ${shippingAddress.province} ${shippingAddress.zipCode}`].filter(Boolean) : []),
		'', 'Questions? Reply to this email or contact info@puretide.ca.', '', 'The Pure Tide Team',
	].join('\n');
	const deliveryAddressHtml = shippingAddress
		? emailInfoBox(`${emailSectionTitle('Delivery address')}<p style="margin:0">${escapeEmailHtml(shippingAddress.address)}<br>${shippingAddress.addressLine2 ? `${escapeEmailHtml(shippingAddress.addressLine2)}<br>` : ''}${escapeEmailHtml(shippingAddress.city)}, ${escapeEmailHtml(shippingAddress.province)} ${escapeEmailHtml(shippingAddress.zipCode)}</p>`)
		: '';
	const customerEmailHtml = buildBrandedEmail({
		title: 'Your order has shipped', status: 'On its way', preheader: `Tracking information for order #${orderNumber}`,
		bodyHtml: `<p>Hi ${escapeEmailHtml(customerName)},</p><p>Great news! Your Pure Tide order <strong>#${escapeEmailHtml(orderNumber)}</strong> has shipped and is on its way to you.</p>${emailInfoBox(`<strong>Tracking number:</strong> <span style="color:#1e5260;font-size:18px;font-weight:700">${escapeEmailHtml(trackingNumber)}</span><br><strong>Carrier:</strong> Canada Post<br><strong>Shipping method:</strong> ${shippingLabel}`, true)}${emailButton('Track your package', 'https://canadapost-postescanada.ca/track')}${deliveryAddressHtml}<p style="margin:24px 0 0">Thank you for choosing Pure Tide.<br><strong>The Pure Tide team</strong></p>`,
	});

	try {
		const result = await sendMail({ to: customerEmail, from: process.env.ORDER_FROM ?? process.env.ORDER_SMTP_FROM ?? process.env.SMTP_FROM, smtpPrefix: 'ORDER', subject, text: customerEmailText, html: customerEmailHtml });
		if (result.sent) {
			console.log(`[shippingEmail] Shipping confirmation sent for order #${orderNumber} to ${customerEmail}`);
			return { success: true, message: 'Shipping confirmation sent successfully' };
		}
		console.error(`[shippingEmail] Failed to send shipping confirmation for order #${orderNumber}:`, result.error);
		return { success: false, error: result.error };
	} catch (error) {
		console.error(`[shippingEmail] Error sending shipping confirmation for order #${orderNumber}:`, error);
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}
