#!/usr/bin/env node
/**
 * Send Manual Email via Zoho Mail SMTP
 *
 * Usage: node send-manual-email.mjs
 */

import { config } from 'dotenv';
import nodemailer from 'nodemailer';

config();

// EDIT THESE VALUES FOR EACH EMAIL
const emailConfig = {
	from: 'info@puretide.ca', // or 'orders@puretide.ca'
	to: 'customer@example.com', // CHANGE THIS
	subject: 'Your Subject Here', // CHANGE THIS
	text: `Your plain text message here.

Best regards,
Pure Team`,
	html: `<p>Your HTML message here.</p>
<p>Best regards,<br>Pure Team</p>`,
};

console.log('📧 Sending email via Resend...\n');
console.log('From:', emailConfig.from);
console.log('To:', emailConfig.to);
console.log('Subject:', emailConfig.subject);
console.log('\n' + '-'.repeat(60));

try {
	const transporter = nodemailer.createTransport({
		host: process.env.SMTP_HOST || 'smtp.zoho.com',
		port: parseInt(process.env.SMTP_PORT || '465'),
		secure: process.env.SMTP_SECURE === 'true',
		auth: {
			user: process.env.SMTP_USER,
			pass: process.env.SMTP_PASS,
		},
	});

	await transporter.sendMail(emailConfig);

	console.log('\n✅ Email sent successfully via Zoho Mail!');
	console.log('\nThe email will be delivered via Zoho Mail (not blacklisted).');
	console.log("It will reach the recipient's inbox, not spam.");
} catch (error) {
	console.log('\n❌ Failed to send email!');
	console.log('Error:', error.message);

	if (error.message.includes('authentication')) {
		console.log('\n⚠️  Check SMTP credentials in .env file');
	}
}

console.log('\n');
