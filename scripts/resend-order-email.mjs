#!/usr/bin/env node
/**
 * Resend Order Confirmation Email
 *
 * Retrieves order details from Wrike and sends confirmation emails
 * to both customer and admin.
 *
 * Usage: node scripts/resend-order-email.mjs <order-number>
 */

import { config } from 'dotenv';
import nodemailer from 'nodemailer';

config();

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';
const orderNumber = process.argv[2] || 'f3e7ef5e8c';

console.log(`\n🔍 Searching for order #${orderNumber} in Wrike...\n`);

async function getTasksInFolder(folderId, apiToken) {
	const response = await fetch(`${WRIKE_API_BASE}/folders/${folderId}/tasks?fields=["description"]`, {
		headers: { Authorization: `Bearer ${apiToken}` },
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch tasks: ${response.status}`);
	}
	const data = await response.json();
	return data.data ?? [];
}

function stripHtml(input) {
	if (!input) return '';
	return String(input)
		.replace(/<br\s*\/?\s*>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<\/h\d>/gi, '\n')
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#64;/g, '@')
		.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
		.replace(/\r\n/g, '\n')
		.trim();
}

function parseOrderFromWrike(description) {
	const html = description;

	// Extract order number
	const orderMatch = html.match(/<h3>Order #([^<]+)<\/h3>/);
	const orderNum = orderMatch ? orderMatch[1].trim() : '';

	// Extract date
	const dateMatch = html.match(/Date: ([^<]+)/);
	const createdAt = dateMatch ? dateMatch[1].trim() : new Date().toISOString();

	// Extract customer name and email
	const nameMatch = html.match(/<b>Name:<\/b>\s*([^<]+)/);
	const emailMatch = html.match(/<b>Email:<\/b>\s*([^<]+)/);
	const name = nameMatch ? stripHtml(nameMatch[1]).trim() : '';
	const email = emailMatch ? stripHtml(emailMatch[1]).trim() : '';
	const [firstName = '', ...lastNameParts] = name.split(' ');
	const lastName = lastNameParts.join(' ');

	// Extract billing address
	const billingMatch = html.match(/<h4>Billing Address<\/h4>\s*<p>([\s\S]*?)<\/p>/);
	const billingText = billingMatch ? stripHtml(billingMatch[1]) : '';
	const billingLines = billingText.split('\n').filter((l) => l.trim());

	// Extract shipping address
	const shippingMatch = html.match(/<h4>Shipping Address<\/h4>\s*<p>([\s\S]*?)<\/p>/);
	const shippingText = shippingMatch ? stripHtml(shippingMatch[1]) : '';
	const shippingLines = shippingText.split('\n').filter((l) => l.trim());

	// Extract order items
	const itemsMatch = html.match(/<h4>Order Items<\/h4>\s*<ul>([\s\S]*?)<\/ul>/);
	const itemsHtml = itemsMatch ? itemsMatch[1] : '';
	const itemMatches = [...itemsHtml.matchAll(/<li>([^×]+)×\s*(\d+)\s*-\s*\$([0-9.]+)<\/li>/g)];
	const cartItems = itemMatches.map((m) => ({
		name: m[1].trim(),
		quantity: parseInt(m[2]),
		price: parseFloat(m[3]) / parseInt(m[2]),
	}));

	// Extract payment method
	const paymentMatch = html.match(/<b>(💳 Credit Card|🏦 E-Transfer)/);
	const paymentMethod = paymentMatch && paymentMatch[1].includes('Credit Card') ? 'creditcard' : 'etransfer';

	// Extract totals
	const subtotalMatch = html.match(/Subtotal:\s*\$([0-9.]+)/);
	const shippingCostMatch = html.match(/Shipping[^:]*:\s*\$([0-9.]+)/);
	const totalMatch = html.match(/<b>Total:\s*\$([0-9.]+)<\/b>/);
	const discountMatch = html.match(/Discount[^:]*:\s*-\$([0-9.]+)/);
	const promoMatch = html.match(/Discount\s*\(([^)]+)\)/);

	const subtotal = subtotalMatch ? parseFloat(subtotalMatch[1]) : 0;
	const shippingCost = shippingCostMatch ? parseFloat(shippingCostMatch[1]) : 0;
	const total = totalMatch ? parseFloat(totalMatch[1]) : 0;
	const discountAmount = discountMatch ? parseFloat(discountMatch[1]) : undefined;
	const promoCode = promoMatch ? promoMatch[1].trim() : undefined;

	// Extract shipping method
	const shippingMethodMatch = html.match(/Shipping \(([^)]+)\)/);
	const shippingMethod = shippingMethodMatch && shippingMethodMatch[1].toLowerCase().includes('express') ? 'express' : 'regular';

	return {
		orderNumber: orderNum,
		createdAt,
		customer: {
			firstName,
			lastName,
			email,
			address: billingLines[0] || '',
			addressLine2: '',
			city: billingLines[1]?.split(',')[0] || '',
			province: billingLines[1]?.split(',')[1]?.split(' ')[1] || '',
			zipCode: billingLines[1]?.split(' ').pop() || '',
			country: billingLines[2] || 'Canada',
			orderNotes: '',
		},
		shipToDifferentAddress: shippingText !== billingText,
		shippingAddress:
			shippingText !== billingText
				? {
						address: shippingLines[0] || '',
						addressLine2: '',
						city: shippingLines[1]?.split(',')[0] || '',
						province: shippingLines[1]?.split(',')[1]?.split(' ')[1] || '',
						zipCode: shippingLines[1]?.split(' ').pop() || '',
					}
				: undefined,
		shippingMethod,
		paymentMethod,
		subtotal,
		shippingCost,
		discountAmount,
		promoCode,
		total,
		cartItems,
	};
}

function buildOrderEmails(order) {
	const date = new Date(order.createdAt).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});

	const itemsList = order.cartItems.map((item) => `${item.name} × ${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`).join('\n');

	const itemsHtml = order.cartItems.map((item) => `<li>${item.name} × ${item.quantity} - $${(item.price * item.quantity).toFixed(2)}</li>`).join('');

	const shippingAddr = order.shipToDifferentAddress && order.shippingAddress ? order.shippingAddress : order.customer;

	const paymentInstructions =
		order.paymentMethod === 'etransfer'
			? `\n\nPAYMENT INSTRUCTIONS:\nPlease send an e-transfer to: orders@puretide.ca\nAmount: $${order.total.toFixed(2)}\nSecurity Question: What is the order number?\nAnswer: ${order.orderNumber}\n\nYour order will be processed once payment is received.`
			: '';

	const paymentInstructionsHtml =
		order.paymentMethod === 'etransfer'
			? `<div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 16px; margin: 20px 0;">
			<h3 style="margin-top: 0; color: #0284c7;">Payment Instructions</h3>
			<p><strong>Please send an e-transfer to:</strong> orders@puretide.ca</p>
			<p><strong>Amount:</strong> $${order.total.toFixed(2)}</p>
			<p><strong>Security Question:</strong> What is the order number?<br>
			<strong>Answer:</strong> ${order.orderNumber}</p>
			<p style="margin-bottom: 0;">Your order will be processed once payment is received.</p>
		</div>`
			: '';

	const customerText = `Thank you for your order!

Order #${order.orderNumber}
Date: ${date}

ITEMS:
${itemsList}

SHIPPING ADDRESS:
${order.customer.firstName} ${order.customer.lastName}
${shippingAddr.address}${shippingAddr.addressLine2 ? ' ' + shippingAddr.addressLine2 : ''}
${shippingAddr.city}, ${shippingAddr.province} ${shippingAddr.zipCode}

ORDER SUMMARY:
Subtotal: $${order.subtotal.toFixed(2)}
Shipping (${order.shippingMethod}): $${order.shippingCost.toFixed(2)}${order.discountAmount ? `\nDiscount${order.promoCode ? ` (${order.promoCode})` : ''}: -$${order.discountAmount.toFixed(2)}` : ''}
Total: $${order.total.toFixed(2)}
${paymentInstructions}

Best regards,
Pure Team`;

	const customerHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
		<h2>Thank you for your order!</h2>
		<p><strong>Order #${order.orderNumber}</strong><br>
		Date: ${date}</p>
		
		<h3>Items</h3>
		<ul>${itemsHtml}</ul>
		
		<h3>Shipping Address</h3>
		<p>${order.customer.firstName} ${order.customer.lastName}<br>
		${shippingAddr.address}${shippingAddr.addressLine2 ? ' ' + shippingAddr.addressLine2 : ''}<br>
		${shippingAddr.city}, ${shippingAddr.province} ${shippingAddr.zipCode}</p>
		
		<h3>Order Summary</h3>
		<table style="width: 100%; border-collapse: collapse;">
			<tr><td>Subtotal:</td><td align="right">$${order.subtotal.toFixed(2)}</td></tr>
			<tr><td>Shipping (${order.shippingMethod}):</td><td align="right">$${order.shippingCost.toFixed(2)}</td></tr>
			${order.discountAmount ? `<tr><td>Discount${order.promoCode ? ` (${order.promoCode})` : ''}:</td><td align="right">-$${order.discountAmount.toFixed(2)}</td></tr>` : ''}
			<tr style="font-weight: bold; border-top: 2px solid #000;">
				<td>Total:</td><td align="right">$${order.total.toFixed(2)}</td>
			</tr>
		</table>
		
		${paymentInstructionsHtml}
		
		<p>Best regards,<br>Pure Team</p>
	</div>`;

	const adminText = `New Order Received

Order #${order.orderNumber}
Date: ${date}
Payment Method: ${order.paymentMethod === 'creditcard' ? 'Credit Card' : 'E-Transfer'}

CUSTOMER:
${order.customer.firstName} ${order.customer.lastName}
${order.customer.email}

ITEMS:
${itemsList}

SHIPPING ADDRESS:
${shippingAddr.address}${shippingAddr.addressLine2 ? ' ' + shippingAddr.addressLine2 : ''}
${shippingAddr.city}, ${shippingAddr.province} ${shippingAddr.zipCode}

ORDER SUMMARY:
Subtotal: $${order.subtotal.toFixed(2)}
Shipping (${order.shippingMethod}): $${order.shippingCost.toFixed(2)}${order.discountAmount ? `\nDiscount${order.promoCode ? ` (${order.promoCode})` : ''}: -$${order.discountAmount.toFixed(2)}` : ''}
Total: $${order.total.toFixed(2)}`;

	const adminHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
		<h2>New Order Received</h2>
		<p><strong>Order #${order.orderNumber}</strong><br>
		Date: ${date}<br>
		Payment Method: ${order.paymentMethod === 'creditcard' ? '💳 Credit Card' : '🏦 E-Transfer'}</p>
		
		<h3>Customer</h3>
		<p>${order.customer.firstName} ${order.customer.lastName}<br>
		${order.customer.email}</p>
		
		<h3>Items</h3>
		<ul>${itemsHtml}</ul>
		
		<h3>Shipping Address</h3>
		<p>${shippingAddr.address}${shippingAddr.addressLine2 ? ' ' + shippingAddr.addressLine2 : ''}<br>
		${shippingAddr.city}, ${shippingAddr.province} ${shippingAddr.zipCode}</p>
		
		<h3>Order Summary</h3>
		<table style="width: 100%; border-collapse: collapse;">
			<tr><td>Subtotal:</td><td align="right">$${order.subtotal.toFixed(2)}</td></tr>
			<tr><td>Shipping (${order.shippingMethod}):</td><td align="right">$${order.shippingCost.toFixed(2)}</td></tr>
			${order.discountAmount ? `<tr><td>Discount${order.promoCode ? ` (${order.promoCode})` : ''}:</td><td align="right">-$${order.discountAmount.toFixed(2)}</td></tr>` : ''}
			<tr style="font-weight: bold; border-top: 2px solid #000;">
				<td>Total:</td><td align="right">$${order.total.toFixed(2)}</td>
			</tr>
		</table>
	</div>`;

	return {
		customer: {
			subject: `Order Confirmation #${order.orderNumber}`,
			text: customerText,
			html: customerHtml,
		},
		admin: {
			subject: `New Order #${order.orderNumber} - ${order.customer.firstName} ${order.customer.lastName}`,
			text: adminText,
			html: adminHtml,
		},
	};
}

async function sendEmail(emailConfig) {
	const transporter = nodemailer.createTransport({
		host: process.env.SMTP_HOST || 'smtp.zoho.com',
		port: parseInt(process.env.SMTP_PORT || '465'),
		secure: process.env.SMTP_SECURE !== 'false',
		auth: {
			user: process.env.SMTP_USER,
			pass: process.env.SMTP_PASS,
		},
	});

	await transporter.sendMail(emailConfig);
}

try {
	const apiToken = process.env.WRIKE_API_TOKEN;
	const ordersFolderId = process.env.WRIKE_ORDERS_FOLDER_ID;

	if (!apiToken || !ordersFolderId) {
		console.error('❌ Missing Wrike configuration in .env file');
		console.error('Required: WRIKE_API_TOKEN, WRIKE_ORDERS_FOLDER_ID');
		process.exit(1);
	}

	// Fetch all tasks from orders folder
	const tasks = await getTasksInFolder(ordersFolderId, apiToken);

	// Find the order task
	const orderTask = tasks.find((t) => t.title.includes(`#${orderNumber}`));

	if (!orderTask) {
		console.error(`❌ Order #${orderNumber} not found in Wrike`);
		console.log('\nAvailable orders:');
		tasks.slice(0, 10).forEach((t) => console.log(`  - ${t.title}`));
		process.exit(1);
	}

	console.log(`✅ Found order in Wrike: ${orderTask.title}\n`);

	// Parse order details from Wrike description
	const order = parseOrderFromWrike(orderTask.description);

	console.log('📧 Order Details:');
	console.log(`   Customer: ${order.customer.firstName} ${order.customer.lastName}`);
	console.log(`   Email: ${order.customer.email}`);
	console.log(`   Total: $${order.total.toFixed(2)}`);
	console.log(`   Payment: ${order.paymentMethod === 'creditcard' ? 'Credit Card' : 'E-Transfer'}\n`);

	// Build emails
	const emails = buildOrderEmails(order);

	// Send customer email
	console.log('📤 Sending customer email...');
	await sendEmail({
		from: process.env.ORDER_FROM || 'orders@puretide.ca',
		to: order.customer.email,
		subject: emails.customer.subject,
		text: emails.customer.text,
		html: emails.customer.html,
		replyTo: `${order.customer.firstName} ${order.customer.lastName} <${order.customer.email}>`,
	});
	console.log(`✅ Customer email sent to: ${order.customer.email}\n`);

	// Send admin email
	const adminEmail = process.env.ORDER_NOTIFICATION_EMAIL || 'info@puretide.ca';
	console.log('📤 Sending admin email...');
	await sendEmail({
		from: process.env.ORDER_FROM || 'orders@puretide.ca',
		to: adminEmail,
		subject: emails.admin.subject,
		text: emails.admin.text,
		html: emails.admin.html,
		replyTo: `${order.customer.firstName} ${order.customer.lastName} <${order.customer.email}>`,
	});
	console.log(`✅ Admin email sent to: ${adminEmail}\n`);

	console.log('🎉 All emails sent successfully!\n');
} catch (error) {
	console.error('\n❌ Error:', error.message);
	if (error.stack) {
		console.error('\nStack trace:', error.stack);
	}
	process.exit(1);
}
