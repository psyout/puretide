#!/usr/bin/env node
/**
 * Setup script for Wrike shipping confirmation system
 */

import { config as dotenvConfig } from 'dotenv';
import crypto from 'node:crypto';
dotenvConfig();

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';
const apiToken = process.env.WRIKE_API_TOKEN;

async function listCustomFields() {
	try {
		const response = await fetch(`${WRIKE_API_BASE}/customfields`, {
			headers: { Authorization: `Bearer ${apiToken}` },
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to fetch custom fields: ${response.status} ${error}`);
		}

		const data = await response.json();
		const fields = data.data || [];

		console.log('\n=== Wrike Custom Fields ===\n');
		console.log('Required for shipping confirmation:\n');

		const trackingField = fields.find((f) => f.title.toLowerCase().includes('tracking'));
		if (trackingField) {
			console.log(`  ✅ Tracking Number → id: ${trackingField.id}`);
		} else {
			console.log(`  ❌ "Tracking Number" field not found - create this field (Text type)`);
		}

		console.log('\nAll custom fields:\n');
		fields.forEach((f) => {
			const icon = f.title.toLowerCase().includes('tracking') ? '📦' : '  ';
			console.log(`${icon} ${f.title} → id: ${f.id}`);
		});

		return fields;
	} catch (error) {
		console.error('Error fetching custom fields:', error.message);
		return [];
	}
}

async function createWebhook() {
	const webhookUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/wrike/webhook` : 'https://puretide.ca/api/wrike/webhook';
	const ordersFolderId = process.env.WRIKE_ORDERS_FOLDER_ID;

	console.log(`\n=== Creating Wrike Webhook ===\n`);
	console.log(`Webhook URL: ${webhookUrl}`);
	if (!ordersFolderId) {
		console.error('❌ Missing WRIKE_ORDERS_FOLDER_ID');
		return null;
	}

	try {
		const secret = process.env.WRIKE_WEBHOOK_SECRET;
		const body = {
			hookUrl: webhookUrl,
			events: ['TaskStatusChanged'],
			recursive: true,
		};
		if (secret) {
			body.secret = secret;
		}
		const response = await fetch(`${WRIKE_API_BASE}/folders/${ordersFolderId}/webhooks`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to create webhook: ${response.status} ${error}`);
		}

		const data = await response.json();
		const webhook = data.data?.[0];

		if (webhook) {
			console.log(`\n✅ Webhook created successfully!`);
			console.log(`   Webhook ID: ${webhook.id}`);
			console.log(`   Status: ${webhook.isActive ? 'Active' : 'Inactive'}`);
			console.log(`   Events: ${webhook.events?.join(', ')}`);

			if (!secret) {
				// Generate webhook secret (optional)
				const webhookSecret = crypto.randomBytes(32).toString('hex');

				console.log(`\n🔐 Optional (recommended): enable secure webhooks by setting:`);
				console.log(`   WRIKE_WEBHOOK_SECRET=${webhookSecret}`);
				console.log('\nThen re-run: node scripts/setup-wrike-shipping.mjs --webhook');
			}
		} else {
			console.log('❌ Webhook creation failed - no webhook data returned');
		}

		return webhook;
	} catch (error) {
		console.error('Error creating webhook:', error.message);
		return null;
	}
}

async function validateConfiguration() {
	console.log('=== Wrike Shipping Configuration ===\n');

	const requiredVars = [
		{ name: 'WRIKE_API_TOKEN', value: process.env.WRIKE_API_TOKEN },
		{ name: 'WRIKE_ORDERS_FOLDER_ID', value: process.env.WRIKE_ORDERS_FOLDER_ID },
		{ name: 'WRIKE_TRACKING_NUMBER_FIELD_ID', value: process.env.WRIKE_TRACKING_NUMBER_FIELD_ID },
	];

	let allValid = true;

	requiredVars.forEach(({ name, value }) => {
		if (value) {
			console.log(`✅ ${name}: ${value.substring(0, 10)}...`);
		} else {
			console.log(`❌ ${name}: Not set`);
			allValid = false;
		}
	});

	const optionalVars = [{ name: 'WRIKE_WEBHOOK_SECRET', value: process.env.WRIKE_WEBHOOK_SECRET }];

	console.log('\nOptional variables:\n');
	optionalVars.forEach(({ name, value }) => {
		if (value) {
			console.log(`✅ ${name}: Set`);
		} else {
			console.log(`⚠️  ${name}: Not set (webhook verification disabled)`);
		}
	});

	return allValid;
}

async function testWebhookEndpoint() {
	const webhookUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/wrike/webhook` : 'https://puretide.ca/api/wrike/webhook';

	console.log(`\n=== Testing Webhook Endpoint ===\n`);
	console.log(`Testing: ${webhookUrl}`);

	try {
		const response = await fetch(webhookUrl, {
			method: 'GET',
		});

		if (response.ok) {
			const data = await response.json();
			console.log('✅ Webhook endpoint is accessible');
			console.log(`   Response: ${data.status}`);
		} else {
			console.log(`❌ Webhook endpoint returned ${response.status}`);
		}
	} catch (error) {
		console.log(`❌ Cannot reach webhook endpoint: ${error.message}`);
		console.log('   Make sure your application is deployed and accessible');
	}
}

async function showUsage() {
	console.log('\n=== Usage Instructions ===\n');

	console.log('1. Create "Tracking Number" custom field in Wrike (Text type)');
	console.log('2. Add WRIKE_TRACKING_NUMBER_FIELD_ID to your .env file');
	console.log('3. Run this script to create webhook: node scripts/setup-wrike-shipping.mjs --webhook');
	console.log('4. Set webhook secret in Wrike and add to .env');
	console.log('5. Test with: node scripts/test-shipping-confirmation.mjs');

	console.log('\nManual trigger (for testing):\n');
	console.log('curl -X POST https://puretide.ca/api/shipping/confirm \\');
	console.log('  -H "Content-Type: application/json" \\');
	console.log('  -d \'{"orderNumber":"12345","trackingNumber":"123456789"}\'');

	console.log('\nWorkflow:\n');
	console.log('1. Order placed → Wrike task created');
	console.log('2. Ship order → Add tracking number to custom field');
	console.log('3. Mark task as "Completed" → Shipping email sent automatically');
}

// Main execution
async function main() {
	const args = process.argv.slice(2);
	const command = args[0];

	console.log('Wrike Shipping Confirmation Setup\n');

	switch (command) {
		case '--list-fields':
			await listCustomFields();
			break;

		case '--webhook':
			await createWebhook();
			break;

		case '--test':
			await testWebhookEndpoint();
			break;

		case '--validate':
			await validateConfiguration();
			break;

		case '--help':
		default:
			await validateConfiguration();
			await listCustomFields();
			await showUsage();
			break;
	}
}

main().catch((err) => {
	console.error('Error:', err.message);
	process.exit(1);
});
