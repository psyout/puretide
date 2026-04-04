#!/usr/bin/env node
/**
 * SendGrid SMTP Test
 */

import { config } from 'dotenv';
import nodemailer from 'nodemailer';

config();

console.log('🔍 SendGrid SMTP Test\n');
console.log('=' .repeat(60));

const SMTP_PASS = process.env.SMTP_PASS;
const TEST_EMAIL = 'orders@puretide.ca';

console.log('\n📋 Configuration:');
console.log('-'.repeat(60));
console.log('Host: smtp.sendgrid.net');
console.log('Port: 587');
console.log('User: apikey');
console.log(`API Key: ${SMTP_PASS ? SMTP_PASS.substring(0, 10) + '...' : 'NOT SET'}`);

if (!SMTP_PASS || !SMTP_PASS.startsWith('SG.')) {
	console.log('\n❌ ERROR: SMTP_PASS must be your SendGrid API key (starts with SG.)');
	console.log('Current value:', SMTP_PASS || 'NOT SET');
	process.exit(1);
}

console.log('\n📧 Testing SendGrid SMTP...');
console.log('-'.repeat(60));

try {
	const transporter = nodemailer.createTransport({
		host: 'smtp.sendgrid.net',
		port: 587,
		secure: false,
		auth: {
			user: 'apikey',
			pass: SMTP_PASS,
		},
	});

	console.log('Verifying connection...');
	await transporter.verify();
	console.log('✅ Connection verified!');

	console.log('Sending test email...');
	const info = await transporter.sendMail({
		from: TEST_EMAIL,
		to: TEST_EMAIL,
		subject: '🎉 SendGrid SMTP Test - SUCCESS!',
		text: `SendGrid SMTP is working correctly!\n\nSent at: ${new Date().toISOString()}`,
		html: `<h2>✅ SendGrid SMTP is working correctly!</h2>
<p>Your email system now has full redundancy:</p>
<ul>
<li><strong>Primary:</strong> Resend API ✅</li>
<li><strong>Fallback:</strong> SendGrid SMTP ✅</li>
</ul>
<p>Sent at: <strong>${new Date().toISOString()}</strong></p>`,
	});

	console.log('✅ Test email sent successfully!');
	console.log(`   Message ID: ${info.messageId}`);
	console.log(`   From: ${TEST_EMAIL}`);
	console.log(`   To: ${TEST_EMAIL}`);
	
	console.log('\n' + '='.repeat(60));
	console.log('🎉 SUCCESS! SendGrid SMTP is working!');
	console.log('='.repeat(60));
	console.log('\n✅ Your email system now has:');
	console.log('   • Primary: Resend API');
	console.log('   • Fallback: SendGrid SMTP');
	console.log('   • Full redundancy and reliability!');
	console.log('\n📧 Check your inbox at:', TEST_EMAIL);
	console.log('\n');

} catch (error) {
	console.log('❌ SendGrid SMTP test failed!');
	console.log(`   Error: ${error.message}`);
	
	if (error.message.includes('Bad username / password')) {
		console.log('\n⚠️  Authentication Issue:');
		console.log('   1. Verify SMTP_USER is set to: apikey');
		console.log('   2. Verify SMTP_PASS is your SendGrid API key (starts with SG.)');
		console.log('   3. Check API key has "Mail Send" permission in SendGrid dashboard');
	}
	
	console.log('\n📋 Current .env should have:');
	console.log('   SMTP_HOST=smtp.sendgrid.net');
	console.log('   SMTP_PORT=587');
	console.log('   SMTP_SECURE=false');
	console.log('   SMTP_USER=apikey');
	console.log('   SMTP_PASS=SG.your_api_key_here');
	
	process.exit(1);
}
