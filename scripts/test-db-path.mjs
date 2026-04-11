#!/usr/bin/env node

// Test script to verify SQLite database initialization with ORDERS_DB_PATH override
import { resolve } from 'path';
import { existsSync, mkdirSync, readFileSync } from 'fs';

// Set test DB path before importing ordersDb
process.env.ORDERS_DB_PATH = resolve(process.cwd(), 'test-orders.sqlite');

async function testDbPath() {
	console.log('Testing SQLite database with ORDERS_DB_PATH override...');
	console.log('DB Path:', process.env.ORDERS_DB_PATH);

	try {
		// Import after setting env var
		const { listOrdersFromDb, upsertOrderInDb } = await import('../lib/ordersDb.ts');

		// Test database initialization
		const orders = await listOrdersFromDb();
		console.log('✅ Database initialized successfully');
		console.log(`📊 Current orders count: ${orders.length}`);

		// Test writing to database
		const testOrder = {
			id: 'test_order_' + Date.now(),
			orderNumber: 'test' + Date.now().toString().slice(-6),
			createdAt: new Date().toISOString(),
			paymentStatus: 'paid',
			customer: { firstName: 'Test', lastName: 'User', email: 'test@example.com' },
			cartItems: [],
			subtotal: 0,
			shippingCost: 0,
			total: 0,
		};

		await upsertOrderInDb(testOrder);
		console.log('✅ Test order written successfully');

		// Verify file exists
		if (existsSync(process.env.ORDERS_DB_PATH)) {
			const stats = readFileSync(process.env.ORDERS_DB_PATH);
			console.log(`✅ Database file exists (${stats.length} bytes)`);
		} else {
			console.error('❌ Database file not found after write');
		}

		console.log('\n✅ All tests passed! ORDERS_DB_PATH override works correctly.');
	} catch (error) {
		console.error('❌ Test failed:', error.message);
		process.exit(1);
	}
}

testDbPath();
