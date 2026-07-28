#!/usr/bin/env node

// Script to trigger BluePeak webhook fulfillment for a specific order on production
// This simulates a payment.completed webhook to trigger fulfillment
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const WEBHOOK_SECRET = process.env.BLUEPEAK_WEBHOOK_SECRET;
const PRODUCTION_URL = process.env.APP_BASE_URL || 'https://puretide.ca';

const orderNumber = process.argv[2];
if (!orderNumber) {
	console.error('Usage: node scripts/trigger-bluepeak-webhook-production.mjs <orderNumber>');
	process.exit(1);
}

if (!WEBHOOK_SECRET) {
	console.error('BLUEPEAK_WEBHOOK_SECRET not set in .env');
	process.exit(1);
}

async function main() {
	console.log(`📦 Triggering BluePeak webhook fulfillment for order ${orderNumber}...`);
	console.log(`   URL: ${PRODUCTION_URL}\n`);

	try {
		// First, fetch the order to get the amount
		const ORDERS_API_KEY = process.env.ORDERS_API_KEY;
		if (!ORDERS_API_KEY) {
			console.error('ORDERS_API_KEY not set in .env');
			process.exit(1);
		}

		const ordersResp = await fetch(`${PRODUCTION_URL}/api/orders`, {
			headers: {
				'x-api-key': ORDERS_API_KEY,
			},
		});

		if (!ordersResp.ok) {
			console.error(`❌ API error: ${ordersResp.status} ${ordersResp.statusText}`);
			process.exit(1);
		}

		const ordersData = await ordersResp.json();
		if (!ordersData.ok) {
			console.error(`❌ API returned error: ${ordersData.error}`);
			process.exit(1);
		}

		const order = ordersData.orders.find((o) => o.orderNumber === orderNumber);
		if (!order) {
			console.log(`❌ Order not found: ${orderNumber}`);
			process.exit(1);
		}

		console.log('=== ORDER DETAILS ===\n');
		console.log(`Order Number: ${order.orderNumber}`);
		console.log(`Customer: ${order.customer?.firstName} ${order.customer?.lastName} (${order.customer?.email})`);
		console.log(`Total: $${order.total}`);
		console.log(`Current Payment Status: ${order.paymentStatus}`);
		console.log(`Checkout ID: ${order.etransfer?.checkoutId}`);
		console.log(`\n`);

		if (order.paymentStatus === 'paid') {
			console.log('⚠️  Order is already marked as paid.');
			console.log('   Fulfillment may have already been triggered.\n');
			process.exit(0);
		}

		const amount = Number(order.total).toFixed(2);
		const checkoutId = order.etransfer?.checkoutId || `co_${orderNumber}`;

		// Construct BluePeak webhook payload
		const eventId = `evt_manual_${Date.now()}`;
		const createdAt = new Date().toISOString();
		
		const webhookPayload = {
			event_id: eventId,
			event_type: 'payment.completed',
			created_at: createdAt,
			data: {
				checkout_id: checkoutId,
				reference: orderNumber,
				reference_number: orderNumber,
				credit_amount: amount,
				total_credited: amount,
				expected_amount: amount,
				currency: 'CAD',
				status: 'paid',
				overpaid: false,
				memo_mismatch: null,
				sender_email: order.customer?.email || 'sender@example.com',
			},
		};

		const rawBody = JSON.stringify(webhookPayload);
		const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody, 'utf8').digest('base64');

		console.log('🔄 Sending webhook to production...\n');
		console.log('Payload:', JSON.stringify(webhookPayload, null, 2));
		console.log('\n');

		const webhookResp = await fetch(`${PRODUCTION_URL}/api/webhooks/etransfer`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Autodeposit-Signature': signature,
				'X-ADG-Signature': signature,
			},
			body: rawBody,
		});

		const webhookText = await webhookResp.text();
		console.log(`Status: ${webhookResp.status}`);
		console.log(`Response: ${webhookText}\n`);

		if (!webhookResp.ok) {
			console.error('❌ Webhook failed');
			process.exit(1);
		}

		const webhookResult = JSON.parse(webhookText);
		if (webhookResult.ok) {
			console.log('✅ Webhook processed successfully!');
			console.log('   Order should now be marked as paid and fulfillment triggered.');
			console.log('\nNext steps:');
			console.log('  1. Check Wrike for the new task');
			console.log('  2. Verify customer received confirmation email');
			console.log('  3. Verify admin received notification email\n');
		} else {
			console.log('⚠️  Webhook returned non-ok response');
			console.log(JSON.stringify(webhookResult, null, 2));
		}
	} catch (error) {
		console.error('❌ Error:', error.message);
		process.exit(1);
	}
}

main();
