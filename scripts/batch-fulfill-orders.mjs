#!/usr/bin/env node

// Script to batch fulfill multiple orders
import dotenv from 'dotenv';

dotenv.config();

const ORDERS_API_KEY = process.env.ORDERS_API_KEY;
const PRODUCTION_URL = process.env.APP_BASE_URL || 'https://puretide.ca';

// Pass order numbers as arguments, or use a predefined list
const orderNumbers = process.argv.slice(2);

if (orderNumbers.length === 0) {
	console.error('Usage: node scripts/batch-fulfill-orders.mjs <orderNumber1> <orderNumber2> ...');
	console.error('Example: node scripts/batch-fulfill-orders.mjs 79d38c4431 289f6c403f');
	process.exit(1);
}

if (!ORDERS_API_KEY) {
	console.error('ORDERS_API_KEY not set in .env');
	process.exit(1);
}

async function fulfillOrder(orderNumber) {
	try {
		console.log(`\n📦 Processing order ${orderNumber}...`);

		const fulfillResp = await fetch(`${PRODUCTION_URL}/api/orders/${orderNumber}/manual-fulfill`, {
			method: 'POST',
			headers: {
				'x-api-key': ORDERS_API_KEY,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				reason: 'batch_fulfill_stuck_orders',
			}),
		});

		if (!fulfillResp.ok) {
			const errorText = await fulfillResp.text();
			console.error(`❌ Failed: ${fulfillResp.status} ${fulfillResp.statusText}`);
			console.error(errorText);
			return { orderNumber, success: false, error: errorText };
		}

		const fulfillData = await fulfillResp.json();
		console.log(`✅ Success: ${orderNumber}`);
		return { orderNumber, success: true, data: fulfillData };
	} catch (error) {
		console.error(`❌ Error: ${error.message}`);
		return { orderNumber, success: false, error: error.message };
	}
}

async function main() {
	console.log(`📦 Batch fulfilling ${orderNumbers.length} orders...`);
	console.log(`   URL: ${PRODUCTION_URL}\n`);

	const results = [];
	let successCount = 0;
	let failCount = 0;

	for (const orderNumber of orderNumbers) {
		const result = await fulfillOrder(orderNumber);
		results.push(result);
		if (result.success) {
			successCount++;
		} else {
			failCount++;
		}

		// Small delay between requests to avoid overwhelming the server
		await new Promise((resolve) => setTimeout(resolve, 500));
	}

	console.log('\n=== SUMMARY ===\n');
	console.log(`Total orders: ${orderNumbers.length}`);
	console.log(`Successful: ${successCount}`);
	console.log(`Failed: ${failCount}\n`);

	if (failCount > 0) {
		console.log('Failed orders:');
		results.filter((r) => !r.success).forEach((r) => {
			console.log(`  - ${r.orderNumber}: ${r.error}`);
		});
		console.log('');
	}

	console.log('✅ Batch fulfillment complete.');
}

main();
