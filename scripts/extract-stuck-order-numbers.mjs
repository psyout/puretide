#!/usr/bin/env node

// Script to extract order numbers from the list-pending-etransfer-orders output
import dotenv from 'dotenv';

dotenv.config();

const ORDERS_API_KEY = process.env.ORDERS_API_KEY;
const PRODUCTION_URL = process.env.APP_BASE_URL || 'https://puretide.ca';

async function main() {
	console.log('📋 Extracting stuck e-transfer order numbers...\n');

	try {
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

		const etransferOrders = ordersData.orders.filter((o) => o.paymentMethod === 'etransfer');
		const pendingOrders = etransferOrders.filter((o) => o.paymentStatus === 'pending');

		// Filter for orders created more than 1 hour ago
		const stuckOrders = pendingOrders.filter((o) => {
			const createdDate = new Date(o.createdAt);
			const hoursAgo = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
			return hoursAgo > 1;
		});

		console.log(`Found ${stuckOrders.length} stuck orders\n`);
		console.log('Order numbers:');
		stuckOrders.forEach((order) => {
			console.log(order.orderNumber);
		});

		console.log(`\n\nTotal: ${stuckOrders.length} orders`);
		console.log('\nTo batch fulfill, run:');
		console.log(`node scripts/batch-fulfill-orders.mjs ${stuckOrders.map((o) => o.orderNumber).join(' ')}`);
	} catch (error) {
		console.error('❌ Error:', error.message);
		process.exit(1);
	}
}

main();
