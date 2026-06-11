#!/usr/bin/env node

// Script to view latest orders from VPS database via SSH
import { execSync } from 'child_process';

const VPS_USER = process.env.VPS_USER || 'root';
const VPS_HOST = process.env.VPS_HOST || '82.221.139.21';
const VPS_PATH = process.env.VPS_PATH || '/var/www/puretide';
const SSH_KEY = process.env.SSH_KEY_PATH; // Optional: path to SSH private key
const SSH_TARGET = `${VPS_USER}@${VPS_HOST}`;
const REMOTE_DB_PATH = `${VPS_PATH}/data/orders.sqlite`;

async function main() {
	console.log('📦 Fetching orders from VPS database...');
	console.log(`   VPS: ${SSH_TARGET}`);
	console.log(`   Database: ${REMOTE_DB_PATH}\n`);

	try {
		// Build SSH command
		const sshBase = SSH_KEY ? `ssh -i "${SSH_KEY}"` : 'ssh';

		// Run sqlite3 query on VPS to get orders
		const query = `SELECT order_json FROM orders ORDER BY created_at DESC LIMIT 10`;

		const sshCmd = `${sshBase} ${SSH_TARGET} "sqlite3 '${REMOTE_DB_PATH}' '${query}'"`;

		console.log('Querying database on VPS...');
		const output = execSync(sshCmd, { encoding: 'utf-8' });

		if (!output.trim()) {
			console.log('No orders found in database.');
			return;
		}

		// Parse sqlite3 default output (one JSON per line)
		const lines = output.trim().split('\n');
		const orders = lines.map((line) => ({ order_json: line }));
		console.log(`📊 Found ${orders.length} orders (showing latest 10)\n`);
		console.log('=== LATEST ORDERS ===\n');

		for (const order of orders) {
			const parsed = JSON.parse(order.order_json);
			console.log(`📋 Order #${parsed.orderNumber}`);
			console.log(`   ID: ${parsed.id}`);
			console.log(`   Created: ${parsed.createdAt}`);
			console.log(`   Status: ${parsed.paymentStatus}`);
			console.log(`   Customer: ${parsed.customer?.firstName} ${parsed.customer?.lastName} (${parsed.customer?.email})`);
			console.log(`   Total: $${parsed.total}`);
			console.log(`   Items: ${parsed.cartItems?.length || 0}`);
			console.log('');
		}

		console.log('✅ Done.\n');
	} catch (error) {
		console.error('❌ Error:', error.message);
		if (error.message.includes('Permission denied') || error.message.includes('Could not resolve hostname')) {
			console.log('\n💡 Tip: Set SSH_KEY_PATH environment variable if you use an SSH key:');
			console.log('   SSH_KEY_PATH=~/.ssh/id_rsa node scripts/view-vps-orders.mjs');
		}
		process.exit(1);
	}
}

main();
