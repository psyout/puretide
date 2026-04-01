#!/usr/bin/env tsx
/**
 * Comprehensive email test script
 * Tests all 3 email types: customer orders, admin notifications, low stock alerts
 *
 * Run with: npm run test:email
 */

import 'dotenv/config';
import { sendMail, sendLowStockAlert } from '../lib/email';

console.log('🧪 Testing Email System - All Types\n');
console.log('='.repeat(60));

// Test 1: Customer Order Confirmation (external email)
async function testCustomerEmail() {
	console.log('\n📧 Test 1: Customer Order Confirmation');
	console.log('-'.repeat(60));

	const result = await sendMail({
		to: 'customer@example.com',
		from: 'orders@puretide.ca',
		subject: 'Order #TEST123 - Order Confirmation',
		text: 'Thank you for your order! This is a test email.',
		html: '<p>Thank you for your order! This is a <strong>test email</strong>.</p>',
	});

	if (result.sent) {
		console.log('✅ Customer email sent successfully');
	} else {
		console.log('❌ Customer email failed:', result.error);
	}

	return result.sent;
}

// Test 2: Admin Order Notification (internal @puretide.ca)
async function testAdminEmail() {
	console.log('\n📧 Test 2: Admin Order Notification');
	console.log('-'.repeat(60));
	console.log('Testing both orders@ and info@ addresses...\n');

	// Test orders@puretide.ca
	const ordersResult = await sendMail({
		to: 'orders@puretide.ca',
		from: 'orders@puretide.ca',
		subject: 'New Order #TEST123 - To Orders',
		text: 'New order received from test customer.\n\nOrder #TEST123\nTotal: $100.00\n\nSent to: orders@puretide.ca',
		html: '<p><strong>New order received</strong></p><p>Order #TEST123<br>Total: $100.00</p><p><em>Sent to: orders@puretide.ca</em></p>',
		replyTo: 'customer@example.com',
	});

	console.log(`  orders@puretide.ca: ${ordersResult.sent ? '✅ Sent' : '❌ Failed'}`);

	// Test info@puretide.ca as alternative
	const infoResult = await sendMail({
		to: 'info@puretide.ca',
		from: 'orders@puretide.ca',
		subject: 'New Order #TEST123 - To Info',
		text: 'New order received from test customer.\n\nOrder #TEST123\nTotal: $100.00\n\nSent to: info@puretide.ca',
		html: '<p><strong>New order received</strong></p><p>Order #TEST123<br>Total: $100.00</p><p><em>Sent to: info@puretide.ca</em></p>',
		replyTo: 'customer@example.com',
	});

	console.log(`  info@puretide.ca: ${infoResult.sent ? '✅ Sent' : '❌ Failed'}`);

	if (ordersResult.sent || infoResult.sent) {
		console.log('\n✅ Admin email sent successfully');
		return true;
	} else {
		console.log('\n❌ Admin email failed for both addresses');
		return false;
	}
}

// Test 3: Low Stock Alert (internal @puretide.ca)
async function testLowStockAlert() {
	console.log('\n📧 Test 3: Low Stock Alert');
	console.log('-'.repeat(60));

	try {
		await sendLowStockAlert([
			{ name: 'BPC-157 5mg', slug: 'bpc-157-5mg', stock: 3 },
			{ name: 'GHK-Cu 50mg', slug: 'ghk-cu-50mg', stock: 2 },
		]);
		console.log('✅ Low stock alert sent successfully');
		return true;
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		console.log('❌ Low stock alert failed:', message);
		return false;
	}
}

// Run all tests
async function runTests() {
	const results = {
		customer: false,
		admin: false,
		lowStock: false,
	};

	try {
		results.customer = await testCustomerEmail();
		results.admin = await testAdminEmail();
		results.lowStock = await testLowStockAlert();

		console.log('\n' + '='.repeat(60));
		console.log('📊 Test Results Summary');
		console.log('='.repeat(60));
		console.log(`Customer Email:    ${results.customer ? '✅ PASS' : '❌ FAIL'}`);
		console.log(`Admin Email:       ${results.admin ? '✅ PASS' : '❌ FAIL'}`);
		console.log(`Low Stock Alert:   ${results.lowStock ? '✅ PASS' : '❌ FAIL'}`);

		const allPassed = results.customer && results.admin && results.lowStock;

		if (allPassed) {
			console.log('\n🎉 All email tests passed! Email system is working correctly.');
		} else {
			console.log('\n⚠️  Some tests failed. Check the errors above.');
			console.log('\nTroubleshooting:');
			console.log('1. Verify puretide.ca domain in Resend dashboard');
			console.log('2. Clear suppression list for @puretide.ca emails');
			console.log('3. Check RESEND_API_KEY is set correctly');
			console.log('4. Check LOW_STOCK_FROM is set in .env');
		}

		process.exit(allPassed ? 0 : 1);
	} catch (error) {
		console.error('\n❌ Test suite failed:', error);
		process.exit(1);
	}
}

runTests();
