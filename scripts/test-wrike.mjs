#!/usr/bin/env node
/**
 * Test Wrike integration: creates a test task in Orders and Clients folders.
 * Verifies WRIKE_API_TOKEN, WRIKE_ORDERS_FOLDER_ID, WRIKE_CLIENTS_FOLDER_ID.
 *
 * Usage:
 *   node scripts/test-wrike.mjs              - Create test tasks (requires folder IDs in .env)
 *   node scripts/test-wrike.mjs --list       - List folders with API IDs
 *   node scripts/test-wrike.mjs --list-fields - List custom field IDs (for WRIKE_CLIENT_EMAIL_FIELD_ID)
 *
 * If you get "Invalid Folder ID", run with --list to get the correct IDs from the API.
 * The numeric IDs in the Wrike URL may differ from the API folder IDs.
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';
const apiToken = process.env.WRIKE_API_TOKEN;
const ordersFolderId = process.env.WRIKE_ORDERS_FOLDER_ID;
const clientsFolderId = process.env.WRIKE_CLIENTS_FOLDER_ID;
const listMode = process.argv.includes('--list');
const listFieldsMode = process.argv.includes('--list-fields');
const subtasksMode = process.argv.includes('--subtasks');

async function createTask(folderId, title, description, options = {}) {
	const body = { title, description, status: 'Active' };
	if (options.superTaskId) body.superTasks = [options.superTaskId];
	const url = options.superTaskId ? `${WRIKE_API_BASE}/tasks` : `${WRIKE_API_BASE}/folders/${folderId}/tasks`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Wrike API ${res.status}: ${text}`);
	}
	const data = await res.json();
	return data.data?.[0];
}

async function createOrderSubtasks(parentTaskId) {
	const subitems = ['Create shipping labels', 'Pick product', 'Package products', 'Ship out', 'Send customer ship notification with tracking'];
	for (const title of subitems) {
		await createTask(ordersFolderId, title, '', { superTaskId: parentTaskId });
	}
}

async function listFolders() {
	const res = await fetch(`${WRIKE_API_BASE}/folders`, {
		headers: { Authorization: `Bearer ${apiToken}` },
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Wrike API ${res.status}: ${text}`);
	}
	const data = await res.json();
	const folders = data.data || [];
	console.log('Folders (use these IDs in .env):\n');
	folders.forEach((f) => {
		console.log(`  ${f.title}  →  id: ${f.id}`);
	});
	console.log('\nCopy the id values for your Orders and Clients folders into .env');
}

async function listCustomFields() {
	const res = await fetch(`${WRIKE_API_BASE}/customfields`, {
		headers: { Authorization: `Bearer ${apiToken}` },
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Wrike API ${res.status}: ${text}`);
	}
	const data = await res.json();
	const fields = data.data || [];
	console.log('Custom fields (for client stacking, create "Client Email" and set WRIKE_CLIENT_EMAIL_FIELD_ID):\n');
	fields.forEach((f) => {
		console.log(`  ${f.title}  →  id: ${f.id}`);
	});
	console.log('\nAdd WRIKE_CLIENT_EMAIL_FIELD_ID=<id> to .env so multiple orders from the same client update one task.');
}

async function run() {
	console.log('Wrike integration test\n');

	if (!apiToken) {
		console.error('Missing WRIKE_API_TOKEN. Add it to .env and try again.');
		process.exit(1);
	}

	if (listFieldsMode) {
		try {
			await listCustomFields();
		} catch (err) {
			console.error('Error:', err.message);
			process.exit(1);
		}
		return;
	}

	if (listMode) {
		try {
			await listFolders();
		} catch (err) {
			console.error('Error:', err.message);
			console.log('\nIf you use EU data center, try: WRIKE_API_BASE=https://app-eu.wrike.com/api/v4 node scripts/test-wrike.mjs --list');
			process.exit(1);
		}
		return;
	}

	const missing = [!ordersFolderId && 'WRIKE_ORDERS_FOLDER_ID', !clientsFolderId && 'WRIKE_CLIENTS_FOLDER_ID'].filter(Boolean);
	if (missing.length > 0) {
		console.error('Missing:', missing.join(', '));
		console.error('Run with --list to get folder IDs: node scripts/test-wrike.mjs --list');
		process.exit(1);
	}

	console.log('Config: OK');
	console.log('  API base:', WRIKE_API_BASE);
	console.log('  Orders folder:', ordersFolderId);
	console.log('  Clients folder:', clientsFolderId);
	console.log('');

	try {
		const testTitle = `[TEST] Wrike integration check ${new Date().toISOString().slice(0, 19)}`;
		const testDesc = '<p>This task was created by scripts/test-wrike.mjs to verify the integration works.</p>';

		console.log('Creating test task in Orders folder...');
		const orderTask = await createTask(ordersFolderId, testTitle, testDesc);
		console.log('  OK. Task ID:', orderTask?.id);

		if (subtasksMode && orderTask?.id) {
			console.log('Creating 5 subtasks under the Orders test task...');
			await createOrderSubtasks(orderTask.id);
			console.log('  OK. Subtasks created.');
		}

		console.log('Creating test task in Clients folder...');
		const clientTask = await createTask(clientsFolderId, testTitle, testDesc);
		console.log('  OK. Task ID:', clientTask?.id);

		console.log('\nWrike integration is working. Check your Wrike workspace for the test tasks.');
	} catch (err) {
		console.error('\nWrike API error:', err.message);
		process.exit(1);
	}
}

run();
