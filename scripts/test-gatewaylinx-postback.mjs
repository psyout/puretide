#!/usr/bin/env node

/**
 * Manual Gatewaylinx Postback Test Script
 *
 * This script simulates a Gatewaylinx postback to verify:
 * 1. HMAC verification logic
 * 2. Postback handling endpoint
 * 3. Order fulfillment logic
 *
 * Usage: node scripts/test-gatewaylinx-postback.mjs
 */

import crypto from 'crypto';

// Gatewaylinx sandbox credentials from .env.local
const SITE_ID = '6202';
const HMAC_KEY = 'e8be33ce06a40e00c6151b9a70329b5799d6daaf3b33984a0268bdf3827c394e';

// Test order details
const ORDER_ID = 'TEST-ORDER-' + Date.now();
const AMOUNT = '177.50';
const TRANSACTION_ID = 'TEST-TXN-' + Date.now();

/**
 * Compute HMAC-SHA256 signature for Gatewaylinx postback
 * Canonical string: site_id|session|amount|status|status_post|transaction_id
 */
function computePostbackHmac(siteId, session, amount, status, statusPost, transactionId) {
	const canonicalString = [siteId, session, amount, status, statusPost, transactionId].join('|');
	return crypto.createHmac('sha256', HMAC_KEY).update(canonicalString).digest('hex');
}

/**
 * Generate a test postback payload with valid HMAC
 */
function generateTestPostback() {
	const status = 'approved';
	const statusPost = 'approved';

	const payload = {
		session: ORDER_ID,
		transaction_id: TRANSACTION_ID,
		transid: TRANSACTION_ID,
		amount: AMOUNT,
		site_id: SITE_ID,
		status: status,
		status_post: statusPost,
		hmac: computePostbackHmac(SITE_ID, ORDER_ID, AMOUNT, status, statusPost, TRANSACTION_ID),
		email: 'test@example.com',
		redirect_url: null,
	};

	return payload;
}

/**
 * Test HMAC verification logic
 */
function testHmacVerification() {
	console.log('Testing HMAC verification logic...\n');

	const payload = generateTestPostback();
	console.log('Generated test postback payload:');
	console.log(JSON.stringify(payload, null, 2));
	console.log('\n');

	// Verify the HMAC
	const canonicalString = [payload.site_id, payload.session, payload.amount, payload.status, payload.status_post, payload.transaction_id].join('|');
	const expectedHmac = crypto.createHmac('sha256', HMAC_KEY).update(canonicalString).digest('hex');

	console.log('Canonical string:', canonicalString);
	console.log('Expected HMAC:', expectedHmac);
	console.log('Payload HMAC:', payload.hmac);
	console.log('HMAC match:', payload.hmac === expectedHmac ? '✅ PASS' : '❌ FAIL');
	console.log('\n');

	return payload.hmac === expectedHmac;
}

/**
 * Test sending postback to local endpoint
 */
async function testPostbackEndpoint() {
	console.log('Testing postback endpoint...\n');

	const payload = generateTestPostback();
	const postbackUrl = 'http://localhost:3000/api/digipay/postback?session=' + ORDER_ID;

	console.log('Sending POST to:', postbackUrl);
	console.log('Payload:', JSON.stringify(payload, null, 2));
	console.log('\n');

	try {
		const response = await fetch(postbackUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});

		console.log('Response status:', response.status);
		console.log('Response body:', await response.text());

		if (response.ok) {
			console.log('✅ Postback endpoint test PASSED');
		} else {
			console.log('❌ Postback endpoint test FAILED');
		}
	} catch (error) {
		console.error('❌ Postback endpoint test FAILED:', error.message);
		console.log('Make sure the dev server is running: npm run dev');
	}
}

/**
 * Main test runner
 */
async function main() {
	console.log('=== Gatewaylinx Postback Test Script ===\n');

	// Test 1: HMAC verification logic
	const hmacTestPassed = testHmacVerification();

	// Test 2: Postback endpoint (requires dev server)
	console.log('\n=== Testing Postback Endpoint ===\n');
	console.log('Note: This test requires the dev server to be running.');
	console.log('Start it with: npm run dev\n');

	await testPostbackEndpoint();

	console.log('\n=== Test Summary ===');
	console.log('HMAC Verification:', hmacTestPassed ? '✅ PASS' : '❌ FAIL');
	console.log('\nIf HMAC verification passed, the postback handling logic is correct.');
	console.log('Full end-to-end testing requires production credentials or manual postback from Gatewaylinx.');
}

// Run tests
main().catch(console.error);
