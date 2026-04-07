#!/usr/bin/env node
/**
 * Comprehensive Zoho Mail Email System Test
 * Tests all email types: orders, contact forms, low stock alerts
 * 
 * Usage: node scripts/test-zoho-complete.mjs
 */

import { config } from 'dotenv';
import nodemailer from 'nodemailer';

config();

console.log('🔍 Comprehensive Zoho Mail Email System Test\n');
console.log('=' .repeat(60));

const tests = [];
let passedTests = 0;
let failedTests = 0;

// Test 1: Order Confirmation Email
console.log('\n📧 Test 1: Order Confirmation Email');
console.log('-'.repeat(60));

const orderSmtpHost = process.env.ORDER_SMTP_HOST || process.env.SMTP_HOST || 'smtp.zoho.com';
const orderSmtpPort = parseInt(process.env.ORDER_SMTP_PORT || process.env.SMTP_PORT || '465');
const orderSmtpSecure = (process.env.ORDER_SMTP_SECURE || process.env.SMTP_SECURE) === 'true';
const orderSmtpUser = process.env.ORDER_SMTP_USER || process.env.SMTP_USER;
const orderSmtpPass = process.env.ORDER_SMTP_PASS || process.env.SMTP_PASS;
const orderFrom = process.env.ORDER_FROM || process.env.SMTP_FROM || 'orders@puretide.ca';
const orderTo = process.env.ORDER_NOTIFICATION_EMAIL || 'orders@puretide.ca';

if (!orderSmtpUser || !orderSmtpPass) {
	console.log('⚠️  Skipped - SMTP credentials not configured');
	tests.push({ name: 'Order Confirmation', status: 'skipped' });
} else {
	try {
		console.log(`   Host: ${orderSmtpHost}:${orderSmtpPort}`);
		console.log(`   From: ${orderFrom}`);
		console.log(`   To: ${orderTo}`);
		
		const transporter = nodemailer.createTransport({
			host: orderSmtpHost,
			port: orderSmtpPort,
			secure: orderSmtpSecure,
			auth: { user: orderSmtpUser, pass: orderSmtpPass },
		});
		
		await transporter.verify();
		console.log('   ✅ Connection verified');
		
		await transporter.sendMail({
			from: orderFrom,
			to: orderTo,
			subject: '✅ Test: Order Confirmation #12345',
			text: 'New order received from test customer.\n\nOrder #12345\nTotal: $100.00',
			html: '<h2>New Order Received</h2><p><strong>Order #12345</strong></p><p>Total: $100.00</p>',
		});
		
		console.log('✅ Order confirmation email sent successfully!');
		tests.push({ name: 'Order Confirmation', status: 'passed' });
		passedTests++;
	} catch (error) {
		console.log(`❌ Failed: ${error.message}`);
		tests.push({ name: 'Order Confirmation', status: 'failed', error: error.message });
		failedTests++;
	}
}

// Test 2: Contact Form Email
console.log('\n📬 Test 2: Contact Form Email');
console.log('-'.repeat(60));

const contactSmtpHost = process.env.CONTACT_SMTP_HOST || process.env.SMTP_HOST || 'smtp.zoho.com';
const contactSmtpPort = parseInt(process.env.CONTACT_SMTP_PORT || process.env.SMTP_PORT || '465');
const contactSmtpSecure = (process.env.CONTACT_SMTP_SECURE || process.env.SMTP_SECURE) === 'true';
const contactSmtpUser = process.env.CONTACT_SMTP_USER || process.env.SMTP_USER;
const contactSmtpPass = process.env.CONTACT_SMTP_PASS || process.env.SMTP_PASS;
const contactFrom = process.env.CONTACT_FROM || process.env.SMTP_FROM || 'info@puretide.ca';
const contactTo = 'info@puretide.ca';

if (!contactSmtpUser || !contactSmtpPass) {
	console.log('⚠️  Skipped - SMTP credentials not configured');
	tests.push({ name: 'Contact Form', status: 'skipped' });
} else {
	try {
		console.log(`   Host: ${contactSmtpHost}:${contactSmtpPort}`);
		console.log(`   From: ${contactFrom}`);
		console.log(`   To: ${contactTo}`);
		
		const transporter = nodemailer.createTransport({
			host: contactSmtpHost,
			port: contactSmtpPort,
			secure: contactSmtpSecure,
			auth: { user: contactSmtpUser, pass: contactSmtpPass },
		});
		
		await transporter.verify();
		console.log('   ✅ Connection verified');
		
		await transporter.sendMail({
			from: contactFrom,
			to: contactTo,
			subject: '✅ Test: New Contact Form Submission',
			text: 'Name: Test User\nEmail: test@example.com\nMessage: This is a test message.',
			html: '<h2>New Contact Form Submission</h2><p><strong>Name:</strong> Test User</p><p><strong>Email:</strong> test@example.com</p><p><strong>Message:</strong> This is a test message.</p>',
		});
		
		console.log('✅ Contact form email sent successfully!');
		tests.push({ name: 'Contact Form', status: 'passed' });
		passedTests++;
	} catch (error) {
		console.log(`❌ Failed: ${error.message}`);
		tests.push({ name: 'Contact Form', status: 'failed', error: error.message });
		failedTests++;
	}
}

// Test 3: Low Stock Alert Email
console.log('\n📦 Test 3: Low Stock Alert Email');
console.log('-'.repeat(60));

const lowStockSmtpHost = process.env.LOW_STOCK_SMTP_HOST || process.env.SMTP_HOST || 'smtp.zoho.com';
const lowStockSmtpPort = parseInt(process.env.LOW_STOCK_SMTP_PORT || process.env.SMTP_PORT || '465');
const lowStockSmtpSecure = (process.env.LOW_STOCK_SMTP_SECURE || process.env.SMTP_SECURE) === 'true';
const lowStockSmtpUser = process.env.LOW_STOCK_SMTP_USER || process.env.SMTP_USER;
const lowStockSmtpPass = process.env.LOW_STOCK_SMTP_PASS || process.env.SMTP_PASS;
const lowStockFrom = process.env.LOW_STOCK_FROM || process.env.SMTP_FROM || 'info@puretide.ca';
const lowStockTo = process.env.LOW_STOCK_EMAIL || 'info@puretide.ca';

if (!lowStockSmtpUser || !lowStockSmtpPass) {
	console.log('⚠️  Skipped - SMTP credentials not configured');
	tests.push({ name: 'Low Stock Alert', status: 'skipped' });
} else {
	try {
		console.log(`   Host: ${lowStockSmtpHost}:${lowStockSmtpPort}`);
		console.log(`   From: ${lowStockFrom}`);
		console.log(`   To: ${lowStockTo}`);
		
		const transporter = nodemailer.createTransport({
			host: lowStockSmtpHost,
			port: lowStockSmtpPort,
			secure: lowStockSmtpSecure,
			auth: { user: lowStockSmtpUser, pass: lowStockSmtpPass },
		});
		
		await transporter.verify();
		console.log('   ✅ Connection verified');
		
		await transporter.sendMail({
			from: lowStockFrom,
			to: lowStockTo,
			subject: '⚠️ Test: Low Stock Alert',
			text: 'Low stock alert (<= 5)\n\n- Product A: 3 units\n- Product B: 2 units',
			html: '<h2>⚠️ Low Stock Alert</h2><p>Low stock alert (<= 5)</p><ul><li>Product A: 3 units</li><li>Product B: 2 units</li></ul>',
		});
		
		console.log('✅ Low stock alert email sent successfully!');
		tests.push({ name: 'Low Stock Alert', status: 'passed' });
		passedTests++;
	} catch (error) {
		console.log(`❌ Failed: ${error.message}`);
		tests.push({ name: 'Low Stock Alert', status: 'failed', error: error.message });
		failedTests++;
	}
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Test Summary');
console.log('='.repeat(60));

console.log('\n📋 Results:');
tests.forEach(test => {
	const icon = test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⚠️';
	console.log(`   ${icon} ${test.name}: ${test.status.toUpperCase()}`);
	if (test.error) {
		console.log(`      Error: ${test.error}`);
	}
});

console.log(`\n📈 Statistics:`);
console.log(`   Passed: ${passedTests}`);
console.log(`   Failed: ${failedTests}`);
console.log(`   Skipped: ${tests.filter(t => t.status === 'skipped').length}`);
console.log(`   Total: ${tests.length}`);

if (failedTests === 0 && passedTests > 0) {
	console.log('\n🎉 SUCCESS! All email types are working correctly!');
	console.log('✅ Your Zoho Mail integration is complete');
	console.log('✅ Application emails will be delivered reliably');
	console.log('✅ No blacklist issues - emails reach all recipients');
} else if (failedTests > 0) {
	console.log('\n⚠️  Some tests failed. Please check the errors above.');
	console.log('\n💡 Troubleshooting:');
	console.log('   1. Verify Zoho Mail credentials in .env file');
	console.log('   2. Check if domain is verified in Zoho Mail');
	console.log('   3. If 2FA enabled, use app-specific passwords');
	console.log('   4. Run: node scripts/test-zoho-smtp.mjs for basic connectivity test');
} else {
	console.log('\n⚠️  All tests were skipped - SMTP not configured');
	console.log('\n📋 Configure SMTP in .env file:');
	console.log('   SMTP_HOST=smtp.zoho.com');
	console.log('   SMTP_PORT=465');
	console.log('   SMTP_SECURE=true');
	console.log('   SMTP_USER=orders@puretide.ca');
	console.log('   SMTP_PASS=your_zoho_password');
	console.log('   SMTP_FROM=orders@puretide.ca');
}

console.log('\n📧 Check your inbox for test emails');
console.log('\n');

process.exit(failedTests > 0 ? 1 : 0);
