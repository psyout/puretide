#!/usr/bin/env node

import dotenv from 'dotenv';

dotenv.config();

const ORDERS_API_KEY = process.env.ORDERS_API_KEY;
const PRODUCTION_URL = process.env.APP_BASE_URL || 'https://puretide.ca';

async function main() {
	console.log('📋 Checking for pending e-transfer orders in production...');
	console.log(`   URL: ${PRODUCTION_URL}\n`);

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
		console.log(`Found ${etransferOrders.length} total e-transfer orders\n`);

		const pendingOrders = etransferOrders.filter((o) => o.paymentStatus === 'pending');
		const paidOrders = etransferOrders.filter((o) => o.paymentStatus === 'paid');

		console.log(`Pending orders: ${pendingOrders.length}`);
		console.log(`Paid orders: ${paidOrders.length}\n`);

		if (pendingOrders.length === 0) {
			console.log('✅ No pending e-transfer orders found.');
			return;
		}

		console.log('=== PENDING E-TRANSFER ORDERS ===\n');
		pendingOrders.forEach((order) => {
			const createdDate = new Date(order.createdAt);
			const hoursAgo = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60));
			
			console.log(`Order: ${order.orderNumber}`);
			console.log(`  Customer: ${order.customer?.firstName} ${order.customer?.lastName} (${order.customer?.email})`);
			console.log(`  Total: $${order.total}`);
			console.log(`  E-Transfer Status: ${order.etransfer?.status}`);
			console.log(`  Amount Expected: ${order.etransfer?.amountExpected}`);
			console.log(`  Amount Received: ${order.etransfer?.amountReceived}`);
			console.log(`  Created: ${order.createdAt} (${hoursAgo} hours ago)`);
			console.log(`  Checkout ID: ${order.etransfer?.checkoutId}`);
			console.log(`  Last Event At: ${order.etransfer?.lastEventAt}`);
			console.log(`  Wrike Task ID: ${order.wrikeTaskId || 'Not created'}`);
			console.log('');
		});

		// Check for orders that might be stuck (created more than 1 hour ago)
		const stuckOrders = pendingOrders.filter((o) => {
			const createdDate = new Date(o.createdAt);
			const hoursAgo = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
			return hoursAgo > 1;
		});

		if (stuckOrders.length > 0) {
			console.log(`⚠️  ${stuckOrders.length} orders may be stuck (created > 1 hour ago):`);
			stuckOrders.forEach((order) => {
				console.log(`  - ${order.orderNumber}: ${order.customer?.firstName} ${order.customer?.lastName}`);
			});
			console.log('');
		}
	} catch (error) {
		console.error('❌ Error:', error.message);
		process.exit(1);
	}
}

main();
