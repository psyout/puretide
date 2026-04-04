#!/usr/bin/env node
/**
 * Email Diagnostic Test Script
 * Tests orders@puretide.ca email functionality
 * 
 * Usage: node test-email.mjs
 */

import { config } from 'dotenv';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

// Load environment variables
config();

const TEST_EMAIL = 'orders@puretide.ca';
const FROM_EMAIL = process.env.ORDER_FROM || 'orders@puretide.ca';

console.log('🔍 Email System Diagnostic Test\n');
console.log('=' .repeat(60));

// Test 1: Check environment variables
console.log('\n📋 Test 1: Environment Variables');
console.log('-'.repeat(60));

const envVars = {
	'RESEND_API_KEY': process.env.RESEND_API_KEY ? '✅ Set (hidden)' : '❌ Not set',
	'ORDER_FROM': process.env.ORDER_FROM || '⚠️  Using default: orders@puretide.ca',
	'ORDER_NOTIFICATION_EMAIL': process.env.ORDER_NOTIFICATION_EMAIL || '⚠️  Using default: orders@puretide.ca',
	'ORDER_SMTP_HOST': process.env.ORDER_SMTP_HOST || '❌ Not set',
	'ORDER_SMTP_PORT': process.env.ORDER_SMTP_PORT || '❌ Not set',
	'ORDER_SMTP_USER': process.env.ORDER_SMTP_USER || '❌ Not set',
	'ORDER_SMTP_PASS': process.env.ORDER_SMTP_PASS ? '✅ Set (hidden)' : '❌ Not set',
};

for (const [key, value] of Object.entries(envVars)) {
	console.log(`  ${key}: ${value}`);
}

// Test 2: Resend API Test
console.log('\n📧 Test 2: Resend API Test');
console.log('-'.repeat(60));

if (!process.env.RESEND_API_KEY) {
	console.log('❌ RESEND_API_KEY not configured - skipping Resend test');
} else {
	try {
		const resend = new Resend(process.env.RESEND_API_KEY);
		
		console.log('Attempting to send test email via Resend...');
		const result = await resend.emails.send({
			from: FROM_EMAIL,
			to: [TEST_EMAIL],
			subject: '🧪 Test Email - Resend API',
			text: `This is a test email sent at ${new Date().toISOString()}`,
			html: `<p>This is a test email sent at <strong>${new Date().toISOString()}</strong></p>
<p>If you receive this, Resend is working correctly.</p>
<p>Sent from: ${FROM_EMAIL}</p>`,
		});
		
		console.log('✅ Resend API test successful!');
		console.log(`   Email ID: ${result.data?.id || 'N/A'}`);
		console.log(`   From: ${FROM_EMAIL}`);
		console.log(`   To: ${TEST_EMAIL}`);
	} catch (error) {
		console.log('❌ Resend API test failed!');
		console.log(`   Error: ${error.message}`);
		
		if (error.message.includes('domain')) {
			console.log('\n⚠️  Domain Verification Issue Detected:');
			console.log('   - Check if puretide.ca is verified in Resend dashboard');
			console.log('   - Verify DNS records (SPF, DKIM, DMARC) are configured');
			console.log('   - Visit: https://resend.com/domains');
		}
		
		if (error.message.includes('API key')) {
			console.log('\n⚠️  API Key Issue Detected:');
			console.log('   - Verify RESEND_API_KEY is correct');
			console.log('   - Check if API key has been revoked');
		}
	}
}

// Test 3: SMTP Fallback Test
console.log('\n📬 Test 3: SMTP Fallback Test');
console.log('-'.repeat(60));

const smtpHost = process.env.ORDER_SMTP_HOST || process.env.SMTP_HOST;
const smtpPort = process.env.ORDER_SMTP_PORT || process.env.SMTP_PORT;
const smtpUser = process.env.ORDER_SMTP_USER || process.env.SMTP_USER;
const smtpPass = process.env.ORDER_SMTP_PASS || process.env.SMTP_PASS;
const smtpSecure = (process.env.ORDER_SMTP_SECURE || process.env.SMTP_SECURE) === 'true';

if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
	console.log('⚠️  SMTP not fully configured - skipping SMTP test');
	console.log('   This means if Resend fails, emails will NOT be sent');
	console.log('\n   Required variables:');
	console.log(`   - ORDER_SMTP_HOST: ${smtpHost || '❌ missing'}`);
	console.log(`   - ORDER_SMTP_PORT: ${smtpPort || '❌ missing'}`);
	console.log(`   - ORDER_SMTP_USER: ${smtpUser || '❌ missing'}`);
	console.log(`   - ORDER_SMTP_PASS: ${smtpPass ? '✅ set' : '❌ missing'}`);
} else {
	try {
		console.log('Attempting to send test email via SMTP...');
		console.log(`   Host: ${smtpHost}:${smtpPort} (secure: ${smtpSecure})`);
		
		const transporter = nodemailer.createTransport({
			host: smtpHost,
			port: parseInt(smtpPort),
			secure: smtpSecure,
			auth: {
				user: smtpUser,
				pass: smtpPass,
			},
		});
		
		// Verify connection
		await transporter.verify();
		console.log('✅ SMTP connection verified');
		
		// Send test email
		await transporter.sendMail({
			from: FROM_EMAIL,
			to: TEST_EMAIL,
			subject: '🧪 Test Email - SMTP Fallback',
			text: `This is a test email sent via SMTP at ${new Date().toISOString()}`,
			html: `<p>This is a test email sent via SMTP at <strong>${new Date().toISOString()}</strong></p>
<p>If you receive this, SMTP fallback is working correctly.</p>
<p>Sent from: ${FROM_EMAIL}</p>`,
		});
		
		console.log('✅ SMTP test email sent successfully!');
		console.log(`   From: ${FROM_EMAIL}`);
		console.log(`   To: ${TEST_EMAIL}`);
	} catch (error) {
		console.log('❌ SMTP test failed!');
		console.log(`   Error: ${error.message}`);
		
		if (error.message.includes('authentication')) {
			console.log('\n⚠️  Authentication Issue:');
			console.log('   - Verify SMTP username and password are correct');
		}
		
		if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
			console.log('\n⚠️  Connection Issue:');
			console.log('   - Check SMTP host and port are correct');
			console.log('   - Verify firewall allows outbound SMTP connections');
		}
	}
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Summary');
console.log('='.repeat(60));

console.log('\n✉️  Expected behavior:');
console.log('   1. Resend should be PRIMARY email service');
console.log('   2. SMTP should be FALLBACK if Resend fails');
console.log('   3. Admin emails go to: ' + (process.env.ORDER_NOTIFICATION_EMAIL || TEST_EMAIL));
console.log('   4. Customer emails come from: ' + FROM_EMAIL);

console.log('\n🔍 Next Steps:');
if (!process.env.RESEND_API_KEY) {
	console.log('   ⚠️  Configure RESEND_API_KEY for primary email delivery');
}
if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
	console.log('   ⚠️  Configure SMTP fallback to ensure email reliability');
}
console.log('   📧 Check ' + TEST_EMAIL + ' inbox for test emails');
console.log('   📋 Review production logs for email errors');
console.log('   🌐 Verify domain DNS records in Resend dashboard');

console.log('\n✅ Test complete!\n');
