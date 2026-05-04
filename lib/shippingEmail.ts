import { sendMail } from './email';

export interface ShippingConfirmationData {
	orderNumber: string;
	customerEmail: string;
	customerName: string;
	trackingNumber: string;
	shippingMethod: 'regular' | 'express';
	shippingAddress?: {
		address: string;
		addressLine2: string;
		city: string;
		province: string;
		zipCode: string;
	};
}

export async function sendShippingConfirmation(data: ShippingConfirmationData) {
	const { orderNumber, customerEmail, customerName, trackingNumber, shippingMethod, shippingAddress } = data;

	const shippingLabel = shippingMethod === 'express' ? 'Express Shipping' : 'Standard Shipping';

	const subject = `Pure Tide - Your Order #${orderNumber} Has Shipped!`;

	const customerEmailText = `
Dear ${customerName},

Great news! Your Pure Tide order #${orderNumber} has been shipped and is on its way to you.

TRACKING INFORMATION
====================
Tracking Number: ${trackingNumber}
Shipping Method: ${shippingLabel}

You can track your package at: https://canadapost-postescanada.ca/track

${
	shippingAddress
		? `
DELIVERY ADDRESS
================
${shippingAddress.address}
${shippingAddress.addressLine2 ? shippingAddress.addressLine2 + '\n' : ''}${shippingAddress.city}, ${shippingAddress.province} ${shippingAddress.zipCode}
`
		: ''
}

QUESTIONS?
==========
If you have any questions about your order, please reply to this email or contact us at:
Email: info@puretide.ca

Thank you for choosing Pure Tide!

Best regards,
The Pure Tide Team
`.trim();

	const customerEmailHtml = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Order #${orderNumber} Has Shipped</title>
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background: #1C4855; color: white; padding: 20px; text-align: center; }
		.content { padding: 20px; background: #f9f9f9; }
		.tracking-info { background: white; padding: 15px; border-left: 4px solid #6EB4CC; margin: 20px 0; }
		.tracking-number { font-size: 18px; font-weight: bold; color: #1C4855; }
		.footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
		.button { display: inline-block; background: #6EB4CC; color: #1C4855; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 10px 0; }
	</style>
</head>
<body>
	<div class="header">
		<h1>🎉 Your Order Has Shipped!</h1>
		<p>Pure Tide Order #${orderNumber}</p>
	</div>
	
	<div class="content">
		<p>Dear ${customerName},</p>
		
		<p>Great news! Your Pure Tide order has been shipped and is on its way to you.</p>
		
		<div class="tracking-info">
			<h3>📦 Tracking Information</h3>
			<p><strong>Tracking Number:</strong> <span class="tracking-number">${trackingNumber}</span></p>
			<p><strong>Shipping Method:</strong> ${shippingLabel}</p>
			<p><a href="https://canadapost-postescanada.ca/track" class="button">Track Your Package</a></p>
		</div>
		
		${
			shippingAddress
				? `
		<div class="tracking-info">
			<h3>🏠 Delivery Address</h3>
			<p>
				${shippingAddress.address}<br>
				${shippingAddress.addressLine2 ? shippingAddress.addressLine2 + '<br>' : ''}${shippingAddress.city}, ${shippingAddress.province} ${shippingAddress.zipCode}
			</p>
		</div>
		`
				: ''
		}
		
		<p><strong>Questions?</strong><br>
		If you have any questions about your order, please reply to this email or contact us at:<br>
		📧 Email: <a href="mailto:info@puretide.ca">info@puretide.ca</a></p>
		
		<p>Thank you for choosing Pure Tide!</p>
		
		<p>Best regards,<br>
		The Pure Tide Team</p>
	</div>
	
	<div class="footer">
		<p>© 2026 Pure Tide. All rights reserved.</p>
		<p>Pure Tide Advanced Peptide Wellness</p>
	</div>
</body>
</html>
`.trim();

	try {
		const result = await sendMail({
			to: customerEmail,
			from: process.env.ORDER_FROM ?? process.env.ORDER_SMTP_FROM ?? process.env.SMTP_FROM,
			smtpPrefix: 'ORDER',
			subject,
			text: customerEmailText,
			html: customerEmailHtml,
		});

		if (result.sent) {
			console.log(`[shippingEmail] Shipping confirmation sent for order #${orderNumber} to ${customerEmail}`);
			return { success: true, message: 'Shipping confirmation sent successfully' };
		} else {
			console.error(`[shippingEmail] Failed to send shipping confirmation for order #${orderNumber}:`, result.error);
			return { success: false, error: result.error };
		}
	} catch (error) {
		console.error(`[shippingEmail] Error sending shipping confirmation for order #${orderNumber}:`, error);
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}
