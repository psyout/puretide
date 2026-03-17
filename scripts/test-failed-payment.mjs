#!/usr/bin/env node
/**
 * Test failed credit card transaction to verify error handling
 * Simulates a payment failure due to insufficient funds/mismatched info
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const BASE_URL = process.argv[2] || 'http://localhost:3001';

const customer = {
	firstName: 'Test',
	lastName: 'FailedPayment',
	country: 'Canada',
	email: 'failed-test@example.com',
	address: '123 Test St',
	addressLine2: '',
	city: 'Vancouver',
	province: 'British Columbia',
	zipCode: 'V6B 1A1',
	orderNotes: 'Failed payment test - insufficient funds',
};

const cartItem = {
	id: 1,
	name: 'BPC 157',
	price: 70.99,
	quantity: 1,
	image: '/bottles/v01.webp',
	description: 'Tissue repair and recovery support.',
};

const SHIPPING_COST = 20.0; // Western Canada shipping for postal code V6B 1A1 (V = western)
const CARD_FEE_PERCENT = 0.05;

// No volume discount for 1 item (discounts start at quantity 2)
const discountedPrice = cartItem.price; // No discount
const subtotal = discountedPrice * cartItem.quantity;
const cardFee = Number(((subtotal + SHIPPING_COST) * CARD_FEE_PERCENT).toFixed(2));
const total = Number((subtotal + SHIPPING_COST + cardFee).toFixed(2));

console.log('Calculation debug:');
console.log('Original price:', cartItem.price);
console.log('Discounted price:', discountedPrice);
console.log('Subtotal:', subtotal);
console.log('Shipping cost:', SHIPPING_COST);
console.log('Card fee:', cardFee);
console.log('Total:', total);

const cartItems = [cartItem];

const cardPayload = {
	customer,
	shipToDifferentAddress: false,
	shippingMethod: 'express',
	subtotal,
	shippingCost: SHIPPING_COST,
	total,
	cartItems: cartItems.map((item) => ({
		...item,
		image: item.image || '',
		description: item.description || '',
	})),
	paymentMethod: 'creditcard',
	cardFee,
	discountAmount: undefined,
	promoCode: undefined,
	company: '',
	idempotencyKey: `sim-failed-${Date.now()}`,
};

async function run() {
	console.log('Testing failed credit card transaction...');
	console.log('Base URL:', BASE_URL);
	console.log('');

	try {
		// Step 1: Create the order
		console.log('--- Step 1: Creating order ---');
		const createRes = await fetch(`${BASE_URL}/api/digipay/create`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(cardPayload),
		});

		const createData = await createRes.json();
		if (!createRes.ok || !createData.orderNumber) {
			console.error('Order creation failed:', createRes.status, createData);
			return;
		}

		const orderNumber = createData.orderNumber;
		console.log('Order created successfully:', orderNumber);
		console.log('Order confirmation URL:', `${BASE_URL}/order-confirmation?orderNumber=${orderNumber}&token=${createData.token}`);
		console.log('');

		// Step 2: Simulate failed payment postback
		console.log('--- Step 2: Simulating failed payment ---');
		const failedPostbackBody = new URLSearchParams({
			session: orderNumber,
			amount: String(total),
			status: 'failed',
			result: 'Payment failed: Your card has insufficient funds',
		}).toString();

		const postbackRes = await fetch(`${BASE_URL}/api/digipay/postback`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: failedPostbackBody,
		});

		const postbackText = await postbackRes.text();
		console.log('Postback response:', postbackText);
		console.log('');

		// Step 3: Test the order confirmation page with failed status
		console.log('--- Step 3: Testing order confirmation page ---');
		const confirmationUrl = `${BASE_URL}/order-confirmation?orderNumber=${orderNumber}&token=${createData.token}&status=failed&result=Payment%20failed:%20Your%20card%20has%20insufficient%20funds`;
		console.log('Visit this URL to test the failed payment handling:');
		console.log(confirmationUrl);
		console.log('');

		// Step 4: Also test without explicit status (should show failed based on DB)
		console.log('--- Step 4: Testing without explicit status params ---');
		const confirmationUrlNoStatus = `${BASE_URL}/order-confirmation?orderNumber=${orderNumber}&token=${createData.token}`;
		console.log('Visit this URL to test failed payment handling from DB:');
		console.log(confirmationUrlNoStatus);
		console.log('');

		console.log('Test completed!');
		console.log('Expected behavior:');
		console.log('- Should show "Payment not completed" message');
		console.log('- Should NOT show success confirmation');
		console.log('- Cart should be cleared when returning to shop');
		console.log('- Should offer "Try again" and "Return to shop" buttons');
	} catch (e) {
		console.error('Test failed:', e.message);
	}
}

run().catch((e) => {
	console.error(e);
	process.exit(1);
});
