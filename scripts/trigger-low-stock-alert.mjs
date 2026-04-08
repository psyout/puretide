#!/usr/bin/env node

/**
 * Trigger Low Stock Alert
 * Manually triggers the low stock alert endpoint to test the full flow
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

if (!CRON_SECRET) {
	console.error('❌ CRON_SECRET not found in .env file');
	process.exit(1);
}

async function triggerAlert() {
	console.log('🚀 Triggering low stock alert endpoint...\n');
	console.log(`URL: ${BASE_URL}/api/stock/alert`);
	console.log(`Using CRON_SECRET: ${CRON_SECRET.substring(0, 10)}...`);
	console.log('');

	try {
		const response = await fetch(`${BASE_URL}/api/stock/alert`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-cron-secret': CRON_SECRET,
			},
		});

		const data = await response.json();

		console.log(`Status: ${response.status} ${response.statusText}`);
		console.log('Response:', JSON.stringify(data, null, 2));

		if (response.ok) {
			if (data.skipped) {
				console.log(`\n⏭️  Alert skipped: ${data.reason}`);
				if (data.reason === 'no-low-stock') {
					console.log('   ✅ No products are currently low stock (stock > 5)');
				} else if (data.reason === 'cooldown') {
					console.log('   ⏰ Alert was recently sent (cooldown period active)');
					console.log('   💡 Wait for cooldown to expire or delete data/low-stock.json to force send');
				}
			} else {
				console.log(`\n✅ Alert sent successfully!`);
				console.log(`   📦 ${data.count} low stock items`);
				console.log(`   📧 Email sent to: ${process.env.LOW_STOCK_EMAIL || 'info@puretide.ca'}`);
			}
		} else {
			console.error('\n❌ Alert failed:', data.error);
		}
	} catch (error) {
		console.error('\n❌ Request failed:', error.message);
		
		if (error.message.includes('ECONNREFUSED')) {
			console.error('\n💡 The development server is not running.');
			console.error('   Start it with: npm run dev');
		}
	}
}

triggerAlert();
