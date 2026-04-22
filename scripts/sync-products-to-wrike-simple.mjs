#!/usr/bin/env node
/**
 * Simple sync script that reads Google Sheets directly without TypeScript dependencies
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const { GoogleAuth } = await import('google-auth-library');
const { google } = await import('googleapis');

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';
const apiToken = process.env.WRIKE_API_TOKEN;
const productsFolderId = process.env.WRIKE_PRODUCTS_FOLDER_ID;

// Google Sheets configuration
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_RANGE = 'Sheet1!A:L'; // Adjust range as needed

async function getSheetProducts() {
	const auth = new GoogleAuth({
		credentials: {
			client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
			private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
		},
		scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
	});

	const sheets = google.sheets({ version: 'v4', auth });

	try {
		const response = await sheets.spreadsheets.values.get({
			spreadsheetId: SPREADSHEET_ID,
			range: SHEET_RANGE,
		});

		const rows = response.data.values;
		if (!rows || rows.length === 0) {
			console.log('No data found in spreadsheet.');
			return [];
		}

		// Skip header row and parse products
		const headers = rows[0];
		const products = [];

		for (let i = 1; i < rows.length; i++) {
			const row = rows[i];
			if (row.length < headers.length) continue;

			const product = {
				id: row[headers.indexOf('id')] || '',
				slug: row[headers.indexOf('slug')] || '',
				name: row[headers.indexOf('name')] || '',
				description: row[headers.indexOf('description')] || '',
				price: parseFloat(row[headers.indexOf('price')] || '0'),
				stock: parseInt(row[headers.indexOf('stock')] || '0'),
				category: row[headers.indexOf('category')] || '',
				image: row[headers.indexOf('image')] || '',
				status: row[headers.indexOf('status')] || 'published',
			};

			if (product.id && product.name) {
				products.push(product);
			}
		}

		return products;
	} catch (error) {
		console.error('Error reading Google Sheets:', error.message);
		return [];
	}
}

async function getTasksInFolder(folderId) {
	const response = await fetch(`${WRIKE_API_BASE}/folders/${folderId}/tasks`, {
		headers: { Authorization: `Bearer ${apiToken}` },
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to fetch tasks: ${response.status} ${text}`);
	}
	const data = await response.json();
	return data.data ?? [];
}

async function createProductTask(product) {
	const customFields = [];

	if (process.env.WRIKE_PRODUCT_ID_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_PRODUCT_ID_FIELD_ID, value: product.id });
	}
	if (process.env.WRIKE_STOCK_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_STOCK_FIELD_ID, value: String(product.stock) });
	}
	if (process.env.WRIKE_COST_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_COST_FIELD_ID, value: '0' });
	}
	if (process.env.WRIKE_PRICE_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_PRICE_FIELD_ID, value: String(product.price) });
	}
	if (process.env.WRIKE_REORDER_POINT_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_REORDER_POINT_FIELD_ID, value: '5' });
	}

	const description = `<p><b>Product ID:</b> ${product.id}</p><p><b>Category:</b> ${product.category || 'N/A'}</p><p><b>Price:</b> $${product.price.toFixed(2)}</p><p>Inventory managed via Wrike. Stock and cost can be updated in the dashboard.</p>`;

	const body = {
		title: product.name,
		description,
		status: 'Active',
		customFields: customFields.length > 0 ? customFields : undefined,
	};

	const response = await fetch(`${WRIKE_API_BASE}/folders/${productsFolderId}/tasks`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to create task: ${response.status} ${text}`);
	}

	const data = await response.json();
	return data.data?.[0] ?? null;
}

function parseProductIdFromTask(task) {
	const productIdFieldId = process.env.WRIKE_PRODUCT_ID_FIELD_ID;
	if (!productIdFieldId) return null;

	const customFields = task.customFields ?? [];
	const productIdField = customFields.find((f) => f.id === productIdFieldId);
	return productIdField?.value ?? null;
}

async function run() {
	console.log('Wrike Products Sync (Simple Version)\n');

	if (!apiToken) {
		console.error('❌ Missing WRIKE_API_TOKEN');
		process.exit(1);
	}

	if (!productsFolderId) {
		console.error('❌ Missing WRIKE_PRODUCTS_FOLDER_ID');
		console.log('   Run: node scripts/setup-wrike-products.mjs --list');
		process.exit(1);
	}

	if (!process.env.WRIKE_PRODUCT_ID_FIELD_ID) {
		console.error('❌ Missing WRIKE_PRODUCT_ID_FIELD_ID');
		console.log('   Run: node scripts/setup-wrike-products.mjs --list-fields');
		process.exit(1);
	}

	console.log('📋 Reading products from Google Sheets...');
	const sheetProducts = await getSheetProducts();
	console.log(`   Found ${sheetProducts.length} products in Google Sheets\n`);

	console.log('📋 Reading existing Wrike product tasks...');
	const existingTasks = await getTasksInFolder(productsFolderId);
	const existingProductIds = new Set(existingTasks.map(parseProductIdFromTask).filter(Boolean));
	console.log(`   Found ${existingProductIds.size} existing product tasks in Wrike\n`);

	const newProducts = sheetProducts.filter((p) => !existingProductIds.has(p.id));

	if (newProducts.length === 0) {
		console.log('✅ All products are already synced to Wrike!');
		console.log('   No new products to create.\n');
		return;
	}

	console.log(`📦 Creating ${newProducts.length} new product tasks in Wrike...\n`);

	let created = 0;
	let failed = 0;

	for (const product of newProducts) {
		try {
			const task = await createProductTask(product);
			if (task) {
				console.log(`  ✅ ${product.name} (${product.id}) → Task ID: ${task.id}`);
				created++;
			} else {
				console.log(`  ❌ ${product.name} (${product.id}) - Failed to create`);
				failed++;
			}
		} catch (error) {
			console.log(`  ❌ ${product.name} (${product.id}) - Error: ${error.message}`);
			failed++;
		}
	}

	console.log('\n=== Sync Complete ===');
	console.log(`  Created: ${created}`);
	console.log(`  Failed: ${failed}`);
	console.log(`  Already existed: ${sheetProducts.length - newProducts.length}`);
	console.log(`  Total products: ${sheetProducts.length}\n`);

	if (created > 0) {
		console.log('✅ Products synced successfully!');
		console.log('   Stock levels are set to 0 by default.');
		console.log('   Update stock and costs in the dashboard at /dashboard/stock\n');
	}
}

run().catch((err) => {
	console.error('Error:', err.message);
	process.exit(1);
});
