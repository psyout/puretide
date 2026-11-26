#!/usr/bin/env node
/**
 * Simulate an e-transfer order to verify:
 * - Emails are sent (customer + admin)
 * - Stock is decremented in the sheet
 * - Wrike tasks created (Orders + Clients folders)
 *
 * Prerequisites:
 * - App running (e.g. npm run dev) at BASE_URL (default http://localhost:3000)
 * - .env with: Google Sheets (products) and SMTP (order emails)
 *
 * Usage: node scripts/simulate-transactions.mjs [BASE_URL]
 *
 * When BASE_URL is http://localhost:3000, orders are stored in local data/orders.sqlite.
 * When BASE_URL is your production URL, orders are stored on the server's DB.
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig(); // load .env so script uses same shipping/totals as server

const BASE_URL = process.argv[2] || 'http://localhost:3000';

// Must match server: lib/constants getEffectiveShippingCost() and SHIPPING_COSTS.western
const DISABLE_SHIPPING_FEE = process.env.NEXT_PUBLIC_DISABLE_SHIPPING_FEE === 'true';
const EXPRESS_SHIPPING = DISABLE_SHIPPING_FEE ? 0 : 20.0; // Western shipping for V6B 1A1 postal code

const customer = {
	firstName: 'Test',
	lastName: 'Simulation',
	country: 'Canada',
	email: process.env.TEST_ORDER_EMAIL || 'test@example.com',
	address: '123 Test St',
	addressLine2: '',
	city: 'Vancouver',
	province: 'British Columbia',
	zipCode: 'V6B 1A1',
	orderNotes: 'Simulated order – safe to ignore',
};

// Use product id 1 (BPC 157 from fallback) – must exist in your sheet or fallback
const cartItem = {
	id: 1,
	name: 'BPC 157',
	price: 70.99,
	quantity: 1,
	image: '/bottles/v01.webp',
	description: 'Tissue repair and recovery support.',
};

const subtotalEtransfer = cartItem.price * cartItem.quantity;
const totalEtransfer = subtotalEtransfer + EXPRESS_SHIPPING;

const cartItems = [cartItem];

const basePayload = {
	customer,
	shipToDifferentAddress: false,
	shippingMethod: 'express',
	subtotal: subtotalEtransfer,
	shippingCost: EXPRESS_SHIPPING,
	total: totalEtransfer,
	cartItems: cartItems.map((item) => ({
		...item,
		image: item.image || '',
		description: item.description || '',
	})),
};

async function run() {
	console.log('Base URL:', BASE_URL);
	console.log('');

	// --- 1. E-transfer ---
	console.log('--- 1. E-transfer (POST /api/orders) ---');
	const etransferPayload = {
		...basePayload,
		paymentMethod: 'etransfer',
		discountAmount: undefined,
		promoCode: undefined,
		company: '', // honeypot
		idempotencyKey: `sim-etransfer-${Date.now()}`,
	};

	let etransferRes;
	try {
		etransferRes = await fetch(`${BASE_URL}/api/orders`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(etransferPayload),
		});
	} catch (e) {
		console.error('E-transfer request failed:', e.message);
		console.log('Is the app running at', BASE_URL, '?');
		process.exit(1);
	}

	const etransferText = await etransferRes.text();
	let etransferData;
	try {
		etransferData = JSON.parse(etransferText);
	} catch {
		console.error('E-transfer response was not JSON. Status:', etransferRes.status);
		console.error('Body (first 200 chars):', etransferText.slice(0, 200));
		process.exit(1);
	}
	if (!etransferRes.ok) {
		console.error('E-transfer failed:', etransferRes.status, etransferData);
	} else {
		console.log('E-transfer response:', etransferData);
		const orderNum = etransferData.orderNumber ?? etransferData.id ?? '?';
		console.log('');
		console.log('E-transfer email flow:');
		console.log('  1. Customer should receive order confirmation at:', customer.email);
		console.log('  2. Admin should receive notification at orders@puretide.ca (or ORDER_NOTIFICATION_EMAIL)');
		console.log('  Order number:', orderNum);
		console.log('  If no emails arrived, check server logs for "[Orders] Order', orderNum, 'admin email not sent: ..."');
		console.log('  Also check: product stock decreased by 1 in Google Sheet.');
		console.log('  Wrike: Order + Client tasks should appear in Wrike (if WRIKE_* env vars are set).');
	}
	console.log('');

	console.log('Done. Verify the customer and admin inboxes, stock, and order records.');
}

run().catch((e) => {
	console.error(e);
	process.exit(1);
});
