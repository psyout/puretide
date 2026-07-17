#!/usr/bin/env node

/**
 * DigiPay Integration Test Script
 * Tests encryption, URL generation, and API endpoint
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file manually
function loadEnv() {
	const envPath = join(__dirname, '..', '.env');
	try {
		const envContent = readFileSync(envPath, 'utf-8');
		const env = {};
		for (const line of envContent.split('\n')) {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith('#')) {
				const [key, ...valueParts] = trimmed.split('=');
				if (key && valueParts.length > 0) {
					env[key.trim()] = valueParts.join('=').trim();
				}
			}
		}
		return env;
	} catch (error) {
		console.error('Failed to load .env file:', error.message);
		process.exit(1);
	}
}

const env = loadEnv();

// Test configuration
const DIGIPAY_SITE_ID = env.DIGIPAY_SITE_ID;
const DIGIPAY_ENCRYPTION_KEY = env.DIGIPAY_ENCRYPTION_KEY;
const DIGIPAY_POSTBACK_URL = env.DIGIPAY_POSTBACK_URL;
const DIGIPAY_TCOMPLETE_BASE = env.DIGIPAY_TCOMPLETE_BASE;
const DIGIPAY_USE_SANDBOX = env.DIGIPAY_USE_SANDBOX;
const DIGIPAY_SANDBOX_SITE_ID = env.DIGIPAY_SANDBOX_SITE_ID;

console.log('=== DigiPay Configuration Check ===\n');
console.log('DIGIPAY_SITE_ID:', DIGIPAY_SITE_ID ? '✓ Set' : '✗ Missing');
console.log('DIGIPAY_ENCRYPTION_KEY:', DIGIPAY_ENCRYPTION_KEY ? '✓ Set' : '✗ Missing');
console.log('DIGIPAY_POSTBACK_URL:', DIGIPAY_POSTBACK_URL ? '✓ Set' : '✗ Missing');
console.log('DIGIPAY_TCOMPLETE_BASE:', DIGIPAY_TCOMPLETE_BASE ? '✓ Set' : '✗ Missing');
console.log('DIGIPAY_USE_SANDBOX:', DIGIPAY_USE_SANDBOX || 'false');
console.log('DIGIPAY_SANDBOX_SITE_ID:', DIGIPAY_SANDBOX_SITE_ID || 'Not set');

if (!DIGIPAY_SITE_ID || !DIGIPAY_ENCRYPTION_KEY || !DIGIPAY_POSTBACK_URL || !DIGIPAY_TCOMPLETE_BASE) {
	console.error('\n✗ ERROR: Missing required DigiPay environment variables');
	process.exit(1);
}

console.log('\n=== Testing Encryption Function ===\n');

// Import the digipay functions
const digipayModule = await import('../lib/digipay.ts');
const { digipayEncrypt, buildDigipayPaymentUrl } = digipayModule;

// Test encryption
try {
	const testPlaintext = 'https://example.com/test';
	const encrypted = digipayEncrypt(testPlaintext, DIGIPAY_ENCRYPTION_KEY);
	console.log('✓ Encryption function works');
	console.log('  Plaintext:', testPlaintext);
	console.log('  Encrypted length:', encrypted.length);
	console.log('  Encrypted preview:', encrypted.substring(0, 50) + '...');
} catch (error) {
	console.error('✗ Encryption failed:', error.message);
	process.exit(1);
}

console.log('\n=== Testing URL Generation ===\n');

// Test URL generation with sample data
const useSandbox = DIGIPAY_USE_SANDBOX === 'true';
const effectiveSiteId = useSandbox && DIGIPAY_SANDBOX_SITE_ID ? DIGIPAY_SANDBOX_SITE_ID : DIGIPAY_SITE_ID;

const testParams = {
	siteId: effectiveSiteId,
	chargeAmount: '10.00',
	orderDescription: 'Test Order #12345',
	session: 'test12345',
	pburl: DIGIPAY_POSTBACK_URL,
	tcomplete: `${DIGIPAY_TCOMPLETE_BASE}/order-confirmation?orderNumber=test12345`,
	shipped: true,
	firstName: 'John',
	lastName: 'Doe',
	email: 'test@example.com',
	address: '123 Test St',
	city: 'Vancouver',
	state: 'BC',
	zip: 'V6A 1A1',
	country: 'CA',
};

try {
	const redirectUrl = buildDigipayPaymentUrl(testParams, DIGIPAY_ENCRYPTION_KEY);
	console.log('✓ URL generation successful');
	console.log('  Site ID:', effectiveSiteId);
	console.log('  Sandbox mode:', useSandbox);
	console.log('  Redirect URL:', redirectUrl);
	console.log('  URL length:', redirectUrl.length);

	// Check if URL starts with correct base
	if (!redirectUrl.startsWith('https://secure.digipay.co')) {
		console.error('✗ ERROR: URL does not start with https://secure.digipay.co');
	} else {
		console.log('✓ URL has correct base domain');
	}

	// Check if param is present
	if (!redirectUrl.includes('param=')) {
		console.error('✗ ERROR: URL does not contain param parameter');
	} else {
		console.log('✓ URL contains encrypted param');
	}
} catch (error) {
	console.error('✗ URL generation failed:', error.message);
	console.error('Stack:', error.stack);
	process.exit(1);
}

console.log('\n=== Testing API Endpoint ===\n');

// Test the actual API endpoint
const API_BASE = env.DIGIPAY_TCOMPLETE_BASE || 'https://puretide.ca';
const testPayload = {
	customer: {
		firstName: 'John',
		lastName: 'Doe',
		country: 'Canada',
		email: 'test@example.com',
		address: '123 Test St',
		addressLine2: '',
		city: 'Vancouver',
		province: 'British Columbia',
		zipCode: 'V6A 1A1',
		orderNotes: '',
	},
	shipToDifferentAddress: false,
	shippingMethod: 'express',
	paymentMethod: 'creditcard',
	cardFee: 3.55,
	subtotal: 70.99,
	shippingCost: 0,
	discountAmount: 0,
	total: 74.54,
	cartItems: [
		{
			id: 'retatrutide',
			name: 'Retatrutide - 20mg',
			price: 70.99,
			quantity: 1,
			image: '/bottles/v06.webp',
			description: 'Triple‑agonist metabolic support for weight and glucose balance.',
		},
	],
	idempotencyKey: 'test-digipay-' + Date.now(),
};

try {
	const response = await fetch(`${API_BASE}/api/digipay/create`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(testPayload),
	});

	const data = await response.json();

	console.log('Response status:', response.status);
	console.log('Response data:', JSON.stringify(data, null, 2));

	if (response.ok && data.ok && data.redirectUrl) {
		console.log('\n✓ API endpoint works correctly');
		console.log('  Order Number:', data.orderNumber);
		console.log('  Redirect URL:', data.redirectUrl);

		// Validate the redirect URL
		if (!data.redirectUrl.startsWith('https://secure.digipay.co')) {
			console.error('✗ ERROR: Redirect URL has wrong domain');
		} else {
			console.log('✓ Redirect URL has correct domain');
		}
	} else {
		console.error('\n✗ API endpoint returned error');
		console.error('Error:', data.error);
	}
} catch (error) {
	console.error('✗ API endpoint test failed:', error.message);
	console.error('Stack:', error.stack);
}

console.log('\n=== Test Complete ===');
