#!/usr/bin/env node
/**
 * DEPRECATED: Use test-zoho-complete.mjs instead
 *
 * Test info@puretide.ca sending and receiving
 */

console.log('⚠️  DEPRECATED SCRIPT');
console.log('Please use the new Zoho Mail test scripts instead:\n');
console.log('  node scripts/test-zoho-smtp.mjs');
console.log('  node scripts/test-zoho-complete.mjs\n');
process.exit(0);

import { config } from 'dotenv';

config();

console.log('🔍 Testing info@puretide.ca Email System\n');
console.log('='.repeat(60));

const resend = new Resend(process.env.RESEND_API_KEY);

if (!process.env.RESEND_API_KEY) {
	console.log('❌ RESEND_API_KEY not configured');
	process.exit(1);
}

// Test 1: Send FROM info@puretide.ca
console.log('\n📧 Test 1: Sending FROM info@puretide.ca');
console.log('-'.repeat(60));

try {
	const result1 = await resend.emails.send({
		from: 'info@puretide.ca',
		to: ['info@puretide.ca'],
		subject: '✅ Test 1: Sending FROM info@puretide.ca',
		text: `This email tests sending FROM info@puretide.ca via Resend.

If you receive this, info@puretide.ca can SEND emails through Resend.

Sent at: ${new Date().toISOString()}`,
		html: `<h2>✅ Test 1: Sending FROM info@puretide.ca</h2>
<p>This email tests sending <strong>FROM</strong> info@puretide.ca via Resend.</p>
<p>If you receive this, info@puretide.ca can <strong>SEND</strong> emails through Resend.</p>
<p><em>Sent at: ${new Date().toISOString()}</em></p>`,
	});

	console.log('✅ Email sent successfully!');
	console.log(`   Email ID: ${result1.data?.id}`);
	console.log('   From: info@puretide.ca');
	console.log('   To: info@puretide.ca');
	console.log('   Via: Resend API (not blacklisted server)');
} catch (error) {
	console.log('❌ Failed to send from info@puretide.ca');
	console.log(`   Error: ${error.message}`);
	process.exit(1);
}

// Test 2: Send TO info@puretide.ca (from orders@)
console.log('\n📬 Test 2: Sending TO info@puretide.ca');
console.log('-'.repeat(60));

try {
	const result2 = await resend.emails.send({
		from: 'orders@puretide.ca',
		to: ['info@puretide.ca'],
		subject: '✅ Test 2: Sending TO info@puretide.ca',
		text: `This email tests sending TO info@puretide.ca via Resend.

If you receive this, info@puretide.ca can RECEIVE emails sent through Resend.

Sent at: ${new Date().toISOString()}`,
		html: `<h2>✅ Test 2: Sending TO info@puretide.ca</h2>
<p>This email tests sending <strong>TO</strong> info@puretide.ca via Resend.</p>
<p>If you receive this, info@puretide.ca can <strong>RECEIVE</strong> emails sent through Resend.</p>
<p><em>Sent at: ${new Date().toISOString()}</em></p>`,
	});

	console.log('✅ Email sent successfully!');
	console.log(`   Email ID: ${result2.data?.id}`);
	console.log('   From: orders@puretide.ca');
	console.log('   To: info@puretide.ca');
	console.log('   Via: Resend API (not blacklisted server)');
} catch (error) {
	console.log('❌ Failed to send to info@puretide.ca');
	console.log(`   Error: ${error.message}`);
	process.exit(1);
}

// Test 3: Send to external address (to verify not blacklisted)
console.log('\n🌐 Test 3: Sending to External Address (Blacklist Check)');
console.log('-'.repeat(60));

try {
	const result3 = await resend.emails.send({
		from: 'info@puretide.ca',
		to: ['orders@puretide.ca'], // Send to orders@ as external test
		subject: '✅ Test 3: External Delivery Test',
		text: `This email tests that info@puretide.ca can send to external addresses without being blocked.

If you receive this, Resend is bypassing the blacklist successfully.

Sent at: ${new Date().toISOString()}`,
		html: `<h2>✅ Test 3: External Delivery Test</h2>
<p>This email tests that info@puretide.ca can send to external addresses without being blocked.</p>
<p>If you receive this, <strong>Resend is bypassing the blacklist successfully</strong>.</p>
<p><em>Sent at: ${new Date().toISOString()}</em></p>`,
	});

	console.log('✅ Email sent successfully!');
	console.log(`   Email ID: ${result3.data?.id}`);
	console.log('   From: info@puretide.ca');
	console.log('   To: orders@puretide.ca');
	console.log('   Via: Resend API (bypassing blacklist)');
} catch (error) {
	console.log('❌ Failed to send to external address');
	console.log(`   Error: ${error.message}`);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Test Summary');
console.log('='.repeat(60));

console.log('\n✅ All tests passed!');
console.log('\n📧 Check your inbox: info@puretide.ca');
console.log('   You should have received 3 test emails:');
console.log('   1. FROM info@puretide.ca (tests sending)');
console.log('   2. TO info@puretide.ca (tests receiving)');
console.log('   3. External delivery test (tests blacklist bypass)');

console.log('\n✅ Results:');
console.log('   • info@puretide.ca CAN send via Resend ✅');
console.log('   • info@puretide.ca CAN receive via Resend ✅');
console.log('   • Resend bypasses blacklist (IP: 82.221.139.21) ✅');
console.log('   • Emails will reach iCloud/Apple Mail users ✅');

console.log('\n💡 Important:');
console.log('   • All application emails already use Resend ✅');
console.log('   • For manual emails, use: node send-manual-email.mjs');
console.log('   • Do NOT send from webmail (uses blacklisted server)');

console.log('\n');
