#!/usr/bin/env node

// Script to manually fulfill an order by directly updating the database
// This script is meant to be run on the VPS
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import initSqlJs from 'sql.js';

const DB_PATH = process.env.ORDERS_DB_PATH || '/var/www/puretide/data/orders.sqlite';
const orderNumber = process.argv[2];

if (!orderNumber) {
	console.error('Usage: node scripts/manual-fulfill-vps.mjs <orderNumber>');
	process.exit(1);
}

async function main() {
	console.log(`📦 Manually fulfilling order ${orderNumber} on VPS...`);
	console.log(`   Database: ${DB_PATH}\n`);

	if (!existsSync(DB_PATH)) {
		console.error(`❌ Database not found: ${DB_PATH}`);
		process.exit(1);
	}

	const SQL = await initSqlJs();
	const db = new SQL.Database(readFileSync(DB_PATH));

	try {
		// Get the order
		const orderStmt = db.prepare('SELECT order_json FROM orders WHERE order_number = ? LIMIT 1');
		orderStmt.bind([orderNumber]);
		if (!orderStmt.step()) {
			console.error(`❌ Order not found: ${orderNumber}`);
			orderStmt.free();
			db.close();
			process.exit(1);
		}

		const orderJson = orderStmt.getAsObject().order_json as string;
		const order = JSON.parse(orderJson);
		orderStmt.free();

		console.log('=== ORDER DETAILS ===\n');
		console.log(`Order Number: ${order.orderNumber}`);
		console.log(`Customer: ${order.customer?.firstName} ${order.customer?.lastName} (${order.customer?.email})`);
		console.log(`Total: $${order.total}`);
		console.log(`Current Payment Status: ${order.paymentStatus}`);
		console.log(`\n`);

		if (order.paymentStatus === 'paid') {
			console.log('⚠️  Order is already marked as paid.');
			console.log('   Fulfillment may have already been triggered.\n');
			db.close();
			process.exit(0);
		}

		const paidAt = new Date().toISOString();

		// Update order to paid
		order.paymentStatus = 'paid';
		order.paidAt = paidAt;
		if (order.etransfer) {
			order.etransfer.paidAt = paidAt;
			order.etransfer.status = 'paid';
		}
		order.fulfillmentStatus = {
			stockUpdated: false,
			emailsSent: false,
			clientSynced: false,
		};

		// Update in database
		const updateStmt = db.prepare('UPDATE orders SET order_json = ? WHERE order_number = ?');
		updateStmt.bind([JSON.stringify(order), orderNumber]);
		updateStmt.step();
		updateStmt.free();

		console.log('✅ Order marked as paid in database\n');
		console.log('⚠️  Note: Fulfillment (Wrike task creation, email sending) needs to be triggered separately.');
		console.log('   The production server will need to process this order or you can manually:');
		console.log('   1. Check Wrike for the task');
		console.log('   2. Manually send confirmation emails\n');

		db.close();
	} catch (error) {
		console.error('❌ Error:', error.message);
		db.close();
		process.exit(1);
	}
}

main();
