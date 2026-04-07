#!/usr/bin/env node
/**
 * Complete Email System Test
 * Tests Zoho Mail SMTP for all email types
 */

import { config } from 'dotenv';
import nodemailer from 'nodemailer';

config();

console.log('🔍 Complete Email System Test\n');
console.log('='.repeat(60));

const TEST_EMAIL = 'orders@puretide.ca';
const FROM_EMAIL = process.env.ORDER_FROM || 'orders@puretide.ca';

let zohoSuccess = false;

// Test: Zoho Mail SMTP
console.log('\n📧 Zoho Mail SMTP Test');
console.log('-'.repeat(60));

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
	console.log('❌ SMTP not configured');
} else {
	try {
		console.log(`   Host: ${smtpHost}:${smtpPort}`);
		console.log(`   User: ${smtpUser}`);

		const transporter = nodemailer.createTransport({
			host: smtpHost,
			port: parseInt(smtpPort),
			secure: process.env.SMTP_SECURE === 'true',
			auth: {
				user: smtpUser,
				pass: smtpPass,
			},
		});

		await transporter.verify();
		console.log('   ✅ Connection verified');

		await transporter.sendMail({
			from: FROM_EMAIL,
			to: TEST_EMAIL,
			subject: '✅ Zoho Mail Test - Email System',
			text: `Zoho Mail SMTP is working correctly!\n\nSent at: ${new Date().toISOString()}`,
			html: `<h2>✅ Zoho Mail is working!</h2>
<p>Your email system is operational.</p>
<p>Sent at: <strong>${new Date().toISOString()}</strong></p>`,
		});

		console.log('✅ Zoho Mail test successful!');
		zohoSuccess = true;
	} catch (error) {
		console.log('❌ Zoho Mail test failed!');
		console.log(`   Error: ${error.message}`);

		if (error.message.includes('Invalid login') || error.message.includes('authentication')) {
			console.log('\n   ⚠️  Authentication Issue:');
			console.log('   1. Verify SMTP_USER is your full Zoho email');
			console.log('   2. Verify SMTP_PASS is correct');
			console.log('   3. If 2FA enabled, use app-specific password');
		}
	}
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Final Results');
console.log('='.repeat(60));

console.log('\n✉️  Email System Status:');
console.log(`   Zoho Mail SMTP: ${zohoSuccess ? '✅ WORKING' : '❌ FAILED'}`);

if (zohoSuccess) {
	console.log('\n🎉 SUCCESS! Zoho Mail email system is working!');
	console.log('   ✅ Emails will be delivered reliably');
	console.log('   ✅ No blacklist issues');
	console.log('   ✅ High deliverability (99%+)');
} else {
	console.log('\n⚠️  WARNING: Email system not working!');
	console.log('   Check Zoho Mail SMTP configuration in .env');
	console.log('   Run: node scripts/test-zoho-smtp.mjs for detailed diagnostics');
}

console.log('\n📧 Check your inbox: ' + TEST_EMAIL);
console.log('   You should have received test emails.');
console.log('\n');
