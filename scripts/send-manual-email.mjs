#!/usr/bin/env node
/**
 * Send Manual Email via Resend
 * Use this instead of webmail to avoid blacklist issues
 * 
 * Usage: node send-manual-email.mjs
 */

import { config } from 'dotenv';
import { Resend } from 'resend';

config();

const resend = new Resend(process.env.RESEND_API_KEY);

// EDIT THESE VALUES FOR EACH EMAIL
const emailConfig = {
	from: 'info@puretide.ca',  // or 'orders@puretide.ca'
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
	const result = await resend.emails.send(emailConfig);
	
	console.log('\n✅ Email sent successfully!');
	console.log('Email ID:', result.data?.id);
	console.log('\nThe email will be delivered via Resend (not blacklisted).');
	console.log('It will reach the recipient\'s inbox, not spam.');
	
} catch (error) {
	console.log('\n❌ Failed to send email!');
	console.log('Error:', error.message);
	
	if (error.message.includes('domain')) {
		console.log('\n⚠️  Make sure the sender email uses @puretide.ca domain');
	}
}

console.log('\n');
