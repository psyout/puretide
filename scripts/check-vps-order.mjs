#!/usr/bin/env node

// Script to check a specific order from VPS database via SSH
import { execSync } from 'child_process';

const VPS_USER = process.env.VPS_USER || 'root';
const VPS_HOST = process.env.VPS_HOST || '82.221.139.21';
const VPS_PATH = process.env.VPS_PATH || '/var/www/puretide';
const SSH_KEY = process.env.SSH_KEY_PATH;
const SSH_TARGET = `${VPS_USER}@${VPS_HOST}`;
const REMOTE_DB_PATH = `${VPS_PATH}/data/orders.sqlite`;

const orderNumber = process.argv[2];
if (!orderNumber) {
	console.error('Usage: node scripts/check-vps-order.mjs <orderNumber>');
	process.exit(1);
}

async function main() {
	console.log(`📦 Fetching order ${orderNumber} from VPS database...`);
	console.log(`   VPS: ${SSH_TARGET}`);
	console.log(`   Database: ${REMOTE_DB_PATH}\n`);

	try {
		const sshBase = SSH_KEY ? `ssh -i "${SSH_KEY}"` : 'ssh';
		const query = `SELECT order_json FROM orders WHERE order_number = '${orderNumber}' LIMIT 1`;
		const sshCmd = `${sshBase} ${SSH_TARGET} "sqlite3 '${REMOTE_DB_PATH}' '${query}'"`;

		console.log('Querying database on VPS...');
		const output = execSync(sshCmd, { encoding: 'utf-8' });

		if (!output.trim()) {
			console.log(`❌ Order not found: ${orderNumber}`);
			process.exit(1);
		}

		const parsed = JSON.parse(output.trim());
		console.log('=== ORDER DETAILS ===\n');
		console.log(`Order Number: ${parsed.orderNumber}`);
		console.log(`ID: ${parsed.id}`);
		console.log(`Created At: ${parsed.createdAt}`);
		console.log(`Payment Status: ${parsed.paymentStatus}`);
		console.log(`Payment Method: ${parsed.paymentMethod}`);
		console.log(`Total: $${parsed.total}`);
		console.log(`Paid At: ${parsed.paidAt || 'Not paid'}`);
		console.log(`Customer: ${parsed.customer?.firstName} ${parsed.customer?.lastName} (${parsed.customer?.email})`);
		console.log(`Phone: ${parsed.customer?.phone || 'N/A'}`);
		console.log(`Address: ${parsed.customer?.address?.street}, ${parsed.customer?.address?.city}, ${parsed.customer?.address?.province} ${parsed.customer?.address?.postalCode}`);
		console.log(`\nCart Items (${parsed.cartItems?.length || 0}):`);
		parsed.cartItems?.forEach((item, i) => {
			console.log(`  ${i + 1}. ${item.name} (x${item.quantity}) - $${item.price} each`);
		});
		console.log(`\nE-Transfer: ${JSON.stringify(parsed.etransfer, null, 2)}`);
		console.log(`\nFulfillment Status: ${JSON.stringify(parsed.fulfillmentStatus, null, 2)}`);
		console.log(`\nWrike Task ID: ${parsed.wrikeTaskId || 'Not created'}`);
		console.log(`\n✅ Done.\n`);
	} catch (error) {
		console.error('❌ Error:', error.message);
		process.exit(1);
	}
}

main();
