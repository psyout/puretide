#!/usr/bin/env node
/**
 * Test script for shipping confirmation functionality
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';
const apiToken = process.env.WRIKE_API_TOKEN;

async function findOrderTask(orderNumber) {
	const ordersFolderId = process.env.WRIKE_ORDERS_FOLDER_ID;
	
	if (!ordersFolderId) {
		console.error('❌ WRIKE_ORDERS_FOLDER_ID not configured');
		return null;
	}

	try {
		const response = await fetch(`${WRIKE_API_BASE}/folders/${ordersFolderId}/tasks`, {
			headers: { Authorization: `Bearer ${apiToken}` },
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to fetch tasks: ${response.status} ${error}`);
		}

		const data = await response.json();
		const tasks = data.data || [];

		const orderTask = tasks.find((task) => task.title.includes(`Order #${orderNumber}`));
		
		if (orderTask) {
			console.log(`✅ Found order task: ${orderTask.title} (ID: ${orderTask.id})`);
			return orderTask;
		} else {
			console.log(`❌ Order #${orderNumber} not found in Wrike`);
			return null;
		}
	} catch (error) {
		console.error('Error finding order task:', error.message);
		return null;
	}
}

async function updateTrackingNumber(taskId, trackingNumber) {
	const trackingFieldId = process.env.WRIKE_TRACKING_NUMBER_FIELD_ID;
	
	if (!trackingFieldId) {
		console.error('❌ WRIKE_TRACKING_NUMBER_FIELD_ID not configured');
		return false;
	}

	try {
		console.log(`📝 Updating tracking number to: ${trackingNumber}`);
		
		const response = await fetch(`${WRIKE_API_BASE}/tasks/${taskId}`, {
			method: 'PUT',
			headers: {
				Authorization: `Bearer ${apiToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				customFields: [{
					id: trackingFieldId,
					value: trackingNumber,
				}],
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to update tracking number: ${response.status} ${error}`);
		}

		console.log('✅ Tracking number updated successfully');
		return true;
	} catch (error) {
		console.error('Error updating tracking number:', error.message);
		return false;
	}
}

async function markTaskCompleted(taskId) {
	try {
		console.log('✅ Marking task as completed...');
		
		const response = await fetch(`${WRIKE_API_BASE}/tasks/${taskId}`, {
			method: 'PUT',
			headers: {
				Authorization: `Bearer ${apiToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				status: 'Completed',
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to update task status: ${response.status} ${error}`);
		}

		console.log('✅ Task marked as completed');
		return true;
	} catch (error) {
		console.error('Error marking task completed:', error.message);
		return false;
	}
}

async function testManualAPI(orderNumber, trackingNumber) {
	const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://puretide.ca';
	const apiUrl = `${baseUrl}/api/shipping/confirm`;

	try {
		console.log(`🔄 Testing manual API call...`);
		console.log(`   URL: ${apiUrl}`);
		console.log(`   Order: ${orderNumber}`);
		console.log(`   Tracking: ${trackingNumber}`);

		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				orderNumber,
				trackingNumber,
			}),
		});

		const data = await response.json();

		if (response.ok) {
			console.log('✅ Manual API call successful');
			console.log(`   Response: ${data.message}`);
			return true;
		} else {
			console.log(`❌ Manual API call failed: ${data.error}`);
			return false;
		}
	} catch (error) {
		console.error('Error testing manual API:', error.message);
		return false;
	}
}

async function simulateShippingWorkflow(orderNumber, trackingNumber) {
	console.log(`\n🚚 Simulating Shipping Workflow for Order #${orderNumber}\n`);

	// Step 1: Find the order task
	console.log('Step 1: Finding order task...');
	const task = await findOrderTask(orderNumber);
	if (!task) return false;

	// Step 2: Update tracking number
	console.log('\nStep 2: Updating tracking number...');
	const trackingUpdated = await updateTrackingNumber(task.id, trackingNumber);
	if (!trackingUpdated) return false;

	// Step 3: Mark as completed (this should trigger the webhook)
	console.log('\nStep 3: Marking task as completed...');
	const completed = await markTaskCompleted(task.id);
	if (!completed) return false;

	console.log('\n✅ Workflow simulation complete!');
	console.log('   Check your email for the shipping confirmation.');
	console.log('   If no email received, check the webhook configuration.');

	return true;
}

async function showHelp() {
	console.log('\n=== Shipping Confirmation Test Script ===\n');
	
	console.log('Usage examples:\n');
	
	console.log('1. Test complete workflow:');
	console.log('   node scripts/test-shipping-confirmation.mjs --workflow 12345 "123456789"\n');
	
	console.log('2. Test manual API only:');
	console.log('   node scripts/test-shipping-confirmation.mjs --api 12345 "123456789"\n');
	
	console.log('3. Just find an order:');
	console.log('   node scripts/test-shipping-confirmation.mjs --find 12345\n');
	
	console.log('4. Update tracking number only:');
	console.log('   node scripts/test-shipping-confirmation.mjs --update-tracking 12345 "123456789"\n');
	
	console.log('\nWhat this tests:\n');
	console.log('- Wrike API connectivity');
	console.log('- Custom field updates');
	console.log('- Task status changes');
	console.log('- Manual API endpoint');
	console.log('- Email sending functionality');
}

// Main execution
async function main() {
	const args = process.argv.slice(2);
	const command = args[0];

	if (!command || command === '--help') {
		await showHelp();
		return;
	}

	console.log('Wrike Shipping Confirmation Test\n');

	switch (command) {
		case '--workflow':
			if (args.length < 3) {
				console.error('Usage: --workflow <orderNumber> <trackingNumber>');
				process.exit(1);
			}
			await simulateShippingWorkflow(args[1], args[2]);
			break;
			
		case '--api':
			if (args.length < 3) {
				console.error('Usage: --api <orderNumber> <trackingNumber>');
				process.exit(1);
			}
			await testManualAPI(args[1], args[2]);
			break;
			
		case '--find':
			if (args.length < 2) {
				console.error('Usage: --find <orderNumber>');
				process.exit(1);
			}
			await findOrderTask(args[1]);
			break;
			
		case '--update-tracking':
			if (args.length < 3) {
				console.error('Usage: --update-tracking <orderNumber> <trackingNumber>');
				process.exit(1);
			}
			const task = await findOrderTask(args[1]);
			if (task) {
				await updateTrackingNumber(task.id, args[2]);
			}
			break;
			
		default:
			console.error(`Unknown command: ${command}`);
			await showHelp();
			process.exit(1);
	}
}

main().catch((err) => {
	console.error('Error:', err.message);
	process.exit(1);
});
