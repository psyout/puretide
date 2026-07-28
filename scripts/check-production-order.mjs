#!/usr/bin/env node

// Script to check a specific order from production API
import dotenv from 'dotenv';

dotenv.config();

const ORDERS_API_KEY = process.env.ORDERS_API_KEY;
const PRODUCTION_URL = process.env.APP_BASE_URL || 'https://puretide.ca';

const orderNumber = process.argv[2];
if (!orderNumber) {
	console.error('Usage: node scripts/check-production-order.mjs <orderNumber>');
	process.exit(1);
}

if (!ORDERS_API_KEY) {
	console.error('ORDERS_API_KEY not set in .env');
	process.exit(1);
}

async function main() {
	console.log(`📦 Fetching order ${orderNumber} from production API...`);
	console.log(`   URL: ${PRODUCTION_URL}\n`);

	try {
		const response = await fetch(`${PRODUCTION_URL}/api/orders`, {
			headers: {
				'x-api-key': ORDERS_API_KEY,
			},
		});

		if (!response.ok) {
			console.error(`❌ API error: ${response.status} ${response.statusText}`);
			process.exit(1);
		}

		const data = await response.json();
		if (!data.ok) {
			console.error(`❌ API returned error: ${data.error}`);
			process.exit(1);
		}

		const order = data.orders.find((o) => o.orderNumber === orderNumber);
		if (!order) {
			console.log(`❌ Order not found: ${orderNumber}`);
			console.log(`\nAvailable orders:`);
			data.orders.forEach((o) => {
				console.log(`  - ${o.orderNumber}: ${o.customer?.firstName} ${o.customer?.lastName} (${o.paymentStatus})`);
			});
			process.exit(1);
		}

		console.log('=== ORDER DETAILS ===\n');
		console.log(`Order Number: ${order.orderNumber}`);
		console.log(`ID: ${order.id}`);
		console.log(`Created At: ${order.createdAt}`);
		console.log(`Payment Status: ${order.paymentStatus}`);
		console.log(`Payment Method: ${order.paymentMethod}`);
		console.log(`Total: $${order.total}`);
		console.log(`Paid At: ${order.paidAt || 'Not paid'}`);
		console.log(`Customer: ${order.customer?.firstName} ${order.customer?.lastName} (${order.customer?.email})`);
		console.log(`Phone: ${order.customer?.phone || 'N/A'}`);
		console.log(`Address: ${order.customer?.address?.street}, ${order.customer?.address?.city}, ${order.customer?.address?.province} ${order.customer?.address?.postalCode}`);
		console.log(`\nCart Items (${order.cartItems?.length || 0}):`);
		order.cartItems?.forEach((item, i) => {
			console.log(`  ${i + 1}. ${item.name} (x${item.quantity}) - $${item.price} each`);
		});
		console.log(`\nE-Transfer: ${JSON.stringify(order.etransfer, null, 2)}`);
		console.log(`\nFulfillment Status: ${JSON.stringify(order.fulfillmentStatus, null, 2)}`);
		console.log(`\nWrike Task ID: ${order.wrikeTaskId || 'Not created'}`);
		console.log(`\n✅ Done.\n`);
	} catch (error) {
		console.error('❌ Error:', error.message);
		process.exit(1);
	}
}

main();
