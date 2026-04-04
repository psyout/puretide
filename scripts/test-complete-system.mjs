#!/usr/bin/env node
/**
 * Complete Email System Test
 * Tests both Resend (primary) and SendGrid (fallback)
 */

import { config } from 'dotenv';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

config();

console.log('🔍 Complete Email System Test\n');
console.log('=' .repeat(60));

const TEST_EMAIL = 'orders@puretide.ca';
const FROM_EMAIL = process.env.ORDER_FROM || 'orders@puretide.ca';

let resendSuccess = false;
let sendgridSuccess = false;

// Test 1: Resend (Primary)
console.log('\n📧 Test 1: Resend API (Primary System)');
console.log('-'.repeat(60));

if (!process.env.RESEND_API_KEY) {
	console.log('❌ RESEND_API_KEY not configured');
} else {
	try {
		const resend = new Resend(process.env.RESEND_API_KEY);
		const result = await resend.emails.send({
			from: FROM_EMAIL,
			to: [TEST_EMAIL],
			subject: '✅ Resend Test - Primary Email System',
			text: `Resend is working correctly!\n\nSent at: ${new Date().toISOString()}`,
			html: `<h2>✅ Resend (Primary) is working!</h2>
<p>Your primary email system is operational.</p>
<p>Sent at: <strong>${new Date().toISOString()}</strong></p>`,
		});
		
		console.log('✅ Resend test successful!');
		console.log(`   Email ID: ${result.data?.id || 'N/A'}`);
		resendSuccess = true;
	} catch (error) {
		console.log('❌ Resend test failed!');
		console.log(`   Error: ${error.message}`);
	}
}

// Test 2: SendGrid SMTP (Fallback)
console.log('\n📬 Test 2: SendGrid SMTP (Fallback System)');
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
			subject: '✅ SendGrid Test - Fallback Email System',
			text: `SendGrid SMTP is working correctly!\n\nSent at: ${new Date().toISOString()}`,
			html: `<h2>✅ SendGrid (Fallback) is working!</h2>
<p>Your fallback email system is operational.</p>
<p>Sent at: <strong>${new Date().toISOString()}</strong></p>`,
		});
		
		console.log('✅ SendGrid test successful!');
		sendgridSuccess = true;
	} catch (error) {
		console.log('❌ SendGrid test failed!');
		console.log(`   Error: ${error.message}`);
		
		if (error.message.includes('verified Sender Identity')) {
			console.log('\n   ⚠️  Sender not verified in SendGrid');
			console.log('   → Go to: https://app.sendgrid.com/settings/sender_auth/senders');
			console.log('   → Verify orders@puretide.ca as sender');
		}
	}
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Final Results');
console.log('='.repeat(60));

console.log('\n✉️  Email System Status:');
console.log(`   Primary (Resend):    ${resendSuccess ? '✅ WORKING' : '❌ FAILED'}`);
console.log(`   Fallback (SendGrid): ${sendgridSuccess ? '✅ WORKING' : '⚠️  NEEDS SENDER VERIFICATION'}`);

if (resendSuccess && sendgridSuccess) {
	console.log('\n🎉 PERFECT! Both email systems are working!');
	console.log('   Your email system has full redundancy.');
	console.log('   If Resend fails, SendGrid will automatically take over.');
} else if (resendSuccess) {
	console.log('\n✅ GOOD! Primary email system (Resend) is working.');
	console.log('   Your customers WILL receive emails.');
	console.log('   ⚠️  Complete SendGrid sender verification for full redundancy.');
} else {
	console.log('\n⚠️  WARNING: Primary email system not working!');
	console.log('   Check Resend configuration.');
}

console.log('\n📧 Check your inbox: ' + TEST_EMAIL);
console.log('   You should have received test emails.');
console.log('\n');
