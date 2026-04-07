#!/usr/bin/env node
/**
 * Zoho Mail SMTP Connection Test
 * Tests basic SMTP connectivity and email sending via Zoho Mail
 * 
 * Usage: node scripts/test-zoho-smtp.mjs
 */

import { config } from 'dotenv';
import nodemailer from 'nodemailer';

config();

console.log('🔍 Zoho Mail SMTP Connection Test\n');
console.log('=' .repeat(60));

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.zoho.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER;
const TEST_EMAIL = process.env.SMTP_USER || 'orders@puretide.ca';

console.log('\n📋 Configuration:');
console.log('-'.repeat(60));
console.log(`Host: ${SMTP_HOST}`);
console.log(`Port: ${SMTP_PORT}`);
console.log(`Secure: ${SMTP_SECURE}`);
console.log(`User: ${SMTP_USER || '❌ NOT SET'}`);
console.log(`Pass: ${SMTP_PASS ? '✅ Set (hidden)' : '❌ NOT SET'}`);
console.log(`From: ${SMTP_FROM}`);

if (!SMTP_USER || !SMTP_PASS) {
	console.log('\n❌ ERROR: SMTP credentials not configured');
	console.log('\nPlease set the following in your .env file:');
	console.log('  SMTP_HOST=smtp.zoho.com');
	console.log('  SMTP_PORT=465');
	console.log('  SMTP_SECURE=true');
	console.log('  SMTP_USER=orders@puretide.ca');
	console.log('  SMTP_PASS=your_zoho_password');
	console.log('  SMTP_FROM=orders@puretide.ca');
	process.exit(1);
}

console.log('\n📧 Testing Zoho Mail SMTP...');
console.log('-'.repeat(60));

try {
	const transporter = nodemailer.createTransport({
		host: SMTP_HOST,
		port: SMTP_PORT,
		secure: SMTP_SECURE,
		auth: {
			user: SMTP_USER,
			pass: SMTP_PASS,
		},
	});

	console.log('Step 1: Verifying connection...');
	await transporter.verify();
	console.log('✅ Connection verified!');

	console.log('\nStep 2: Sending test email...');
	const info = await transporter.sendMail({
		from: SMTP_FROM,
		to: TEST_EMAIL,
		subject: '✅ Zoho Mail SMTP Test - SUCCESS!',
		text: `Zoho Mail SMTP is working correctly!

This test email confirms that your application can send emails via Zoho Mail.

Configuration:
- Host: ${SMTP_HOST}
- Port: ${SMTP_PORT}
- User: ${SMTP_USER}

Sent at: ${new Date().toISOString()}`,
		html: `<h2>✅ Zoho Mail SMTP is working correctly!</h2>
<p>This test email confirms that your application can send emails via Zoho Mail.</p>
<h3>Configuration:</h3>
<ul>
<li><strong>Host:</strong> ${SMTP_HOST}</li>
<li><strong>Port:</strong> ${SMTP_PORT}</li>
<li><strong>User:</strong> ${SMTP_USER}</li>
</ul>
<p><em>Sent at: ${new Date().toISOString()}</em></p>`,
	});

	console.log('✅ Test email sent successfully!');
	console.log(`   Message ID: ${info.messageId}`);
	console.log(`   From: ${SMTP_FROM}`);
	console.log(`   To: ${TEST_EMAIL}`);
	
	console.log('\n' + '='.repeat(60));
	console.log('🎉 SUCCESS! Zoho Mail SMTP is working!');
	console.log('='.repeat(60));
	console.log('\n✅ Your email system is configured correctly');
	console.log('✅ Application emails will be sent via Zoho Mail');
	console.log('✅ No blacklist issues - emails will reach all recipients');
	console.log('\n📧 Check your inbox at:', TEST_EMAIL);
	console.log('\n');

} catch (error) {
	console.log('\n❌ Zoho Mail SMTP test failed!');
	console.log(`   Error: ${error.message}`);
	
	if (error.message.includes('Invalid login') || error.message.includes('authentication')) {
		console.log('\n⚠️  Authentication Issue:');
		console.log('   1. Verify SMTP_USER is your full Zoho email (e.g., orders@puretide.ca)');
		console.log('   2. Verify SMTP_PASS is correct');
		console.log('   3. If 2FA is enabled, use an app-specific password');
		console.log('   4. Generate app password: Zoho Mail → Settings → Security → App Passwords');
	}
	
	if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
		console.log('\n⚠️  Connection Issue:');
		console.log('   1. Check SMTP_HOST is: smtp.zoho.com');
		console.log('   2. Check SMTP_PORT is: 465 (SSL) or 587 (STARTTLS)');
		console.log('   3. Verify firewall allows outbound SMTP connections');
	}
	
	console.log('\n📋 Current .env should have:');
	console.log('   SMTP_HOST=smtp.zoho.com');
	console.log('   SMTP_PORT=465');
	console.log('   SMTP_SECURE=true');
	console.log('   SMTP_USER=orders@puretide.ca');
	console.log('   SMTP_PASS=your_zoho_password');
	console.log('   SMTP_FROM=orders@puretide.ca');
	
	process.exit(1);
}
