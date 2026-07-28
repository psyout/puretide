#!/usr/bin/env node

// Script to manually mark an order as paid and trigger fulfillment
// Use this when BluePeak webhooks fail but payment was actually received
import dotenv from 'dotenv';

dotenv.config();

const ORDERS_API_KEY = process.env.ORDERS_API_KEY;
const PRODUCTION_URL = process.env.APP_BASE_URL || 'https://puretide.ca';

const orderNumber = process.argv[2];
if (!orderNumber) {
	console.error('Usage: node scripts/manual-fulfill-order.mjs <orderNumber>');
	process.exit(1);
}

if (!ORDERS_API_KEY) {
	console.error('ORDERS_API_KEY not set in .env');
	process.exit(1);
}

async function main() {
	console.log(`📦 Manually fulfilling order ${orderNumber}...`);
	console.log(`   URL: ${PRODUCTION_URL}\n`);

	try {
		// First, fetch the order
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
		console.log(`E-Transfer Status: ${order.etransfer?.status}`);
		console.log(`Amount Received: ${order.etransfer?.amountReceived}`);
		console.log(`\n`);

		if (order.paymentStatus === 'paid') {
			console.log('⚠️  Order is already marked as paid.');
			console.log('   Fulfillment may have already been triggered.');
			console.log('   Check Wrike for the task and check if emails were sent.\n');
			process.exit(0);
		}

		// Confirm before proceeding
		console.log('⚠️  This will:');
		console.log('   1. Mark the order as paid');
		console.log('   2. Trigger fulfillment (decrement stock, create Wrike task)');
		console.log('   3. Send confirmation emails to customer and admin');
		console.log('');
		console.log('Press Ctrl+C to cancel, or Enter to continue...');
		await new Promise((resolve) => {
			process.stdin.once('data', resolve);
		});

		console.log('\n🔄 Marking order as paid and triggering fulfillment...\n');

		// Call the manual fulfillment endpoint
		const fulfillResp = await fetch(`${PRODUCTION_URL}/api/orders/${orderNumber}/manual-fulfill`, {
			method: 'POST',
			headers: {
				'x-api-key': ORDERS_API_KEY,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				reason: 'manual_fulfill_after_bluepeak_webhook_failure',
			}),
		});

		if (!fulfillResp.ok) {
			const errorText = await fulfillResp.text();
			console.error(`❌ Fulfillment error: ${fulfillResp.status} ${fulfillResp.statusText}`);
			console.error(errorText);
			process.exit(1);
		}

		const fulfillData = await fulfillResp.json();
		console.log('✅ Fulfillment completed successfully!\n');
		console.log('Result:', JSON.stringify(fulfillData, null, 2));
		console.log('\nNext steps:');
		console.log('  1. Check Wrike for the new task');
		console.log('  2. Verify customer received confirmation email');
		console.log('  3. Verify admin received notification email\n');
	} catch (error) {
		console.error('❌ Error:', error.message);
		process.exit(1);
	}
}

main();
