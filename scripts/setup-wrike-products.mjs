#!/usr/bin/env node
/**
 * Setup script for Wrike Products folder
 * 
 * This script helps you:
 * 1. List all folders in your Wrike workspace
 * 2. List all custom fields available
 * 3. Validate your environment configuration
 * 
 * Usage:
 *   node scripts/setup-wrike-products.mjs              - Validate configuration
 *   node scripts/setup-wrike-products.mjs --list       - List folders
 *   node scripts/setup-wrike-products.mjs --list-fields - List custom fields
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';
const apiToken = process.env.WRIKE_API_TOKEN;

const listMode = process.argv.includes('--list');
const listFieldsMode = process.argv.includes('--list-fields');

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
	console.log('Folders in your Wrike workspace:\n');
	folders.forEach((f) => {
		console.log(`  ${f.title}  →  id: ${f.id}`);
	});
	console.log('\nCopy the folder IDs to your .env file:');
	console.log('  WRIKE_ORDERS_FOLDER_ID=...');
	console.log('  WRIKE_CLIENTS_FOLDER_ID=...');
	console.log('  WRIKE_PRODUCTS_FOLDER_ID=...');
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
	console.log('Custom fields in your Wrike workspace:\n');
	fields.forEach((f) => {
		console.log(`  ${f.title}  →  id: ${f.id}  (type: ${f.type})`);
	});
	console.log('\n=== Required Custom Fields for Products ===');
	console.log('Create these custom fields in Wrike and add their IDs to .env:\n');
	console.log('  Product ID (Text)         → WRIKE_PRODUCT_ID_FIELD_ID=...');
	console.log('  Current Stock (Number)    → WRIKE_STOCK_FIELD_ID=...');
	console.log('  Cost Per Unit (Currency)  → WRIKE_COST_FIELD_ID=...');
	console.log('  Supplier Name (Text)      → WRIKE_SUPPLIER_FIELD_ID=...');
	console.log('  Supplier SKU (Text)       → WRIKE_SUPPLIER_SKU_FIELD_ID=...');
	console.log('  Reorder Point (Number)    → WRIKE_REORDER_POINT_FIELD_ID=...');
	console.log('  Reorder Quantity (Number) → WRIKE_REORDER_QTY_FIELD_ID=...');
	console.log('\n=== Optional Custom Fields for Orders (Financial Tracking) ===\n');
	console.log('  Order Revenue (Currency)  → WRIKE_ORDER_REVENUE_FIELD_ID=...');
	console.log('  Order COGS (Currency)     → WRIKE_ORDER_COGS_FIELD_ID=...');
	console.log('  Gross Profit (Currency)   → WRIKE_ORDER_PROFIT_FIELD_ID=...');
	console.log('  Profit Margin (Percentage)→ WRIKE_ORDER_MARGIN_FIELD_ID=...');
}

async function validateConfig() {
	console.log('Wrike Products Setup - Configuration Validation\n');
	
	if (!apiToken) {
		console.error('❌ Missing WRIKE_API_TOKEN');
		console.log('   Add WRIKE_API_TOKEN=... to your .env file\n');
		process.exit(1);
	}
	console.log('✅ WRIKE_API_TOKEN configured');
	
	const productsFolderId = process.env.WRIKE_PRODUCTS_FOLDER_ID;
	if (!productsFolderId) {
		console.log('⚠️  WRIKE_PRODUCTS_FOLDER_ID not set');
		console.log('   Run: node scripts/setup-wrike-products.mjs --list');
		console.log('   Then add WRIKE_PRODUCTS_FOLDER_ID=... to .env\n');
	} else {
		console.log('✅ WRIKE_PRODUCTS_FOLDER_ID configured:', productsFolderId);
	}
	
	const requiredFields = [
		['WRIKE_PRODUCT_ID_FIELD_ID', 'Product ID'],
		['WRIKE_STOCK_FIELD_ID', 'Current Stock'],
		['WRIKE_COST_FIELD_ID', 'Cost Per Unit'],
	];
	
	const optionalFields = [
		['WRIKE_SUPPLIER_FIELD_ID', 'Supplier Name'],
		['WRIKE_SUPPLIER_SKU_FIELD_ID', 'Supplier SKU'],
		['WRIKE_REORDER_POINT_FIELD_ID', 'Reorder Point'],
		['WRIKE_REORDER_QTY_FIELD_ID', 'Reorder Quantity'],
	];
	
	console.log('\nRequired Custom Fields:');
	let missingRequired = false;
	for (const [envVar, label] of requiredFields) {
		if (process.env[envVar]) {
			console.log(`  ✅ ${label} (${envVar})`);
		} else {
			console.log(`  ❌ ${label} (${envVar})`);
			missingRequired = true;
		}
	}
	
	console.log('\nOptional Custom Fields:');
	for (const [envVar, label] of optionalFields) {
		if (process.env[envVar]) {
			console.log(`  ✅ ${label} (${envVar})`);
		} else {
			console.log(`  ⚠️  ${label} (${envVar}) - not configured`);
		}
	}
	
	if (missingRequired) {
		console.log('\n❌ Missing required custom fields');
		console.log('   Run: node scripts/setup-wrike-products.mjs --list-fields');
		console.log('   Create the fields in Wrike and add their IDs to .env\n');
		process.exit(1);
	}
	
	console.log('\n✅ Configuration is valid!');
	console.log('\nNext steps:');
	console.log('  1. Run: node scripts/sync-products-to-wrike.mjs');
	console.log('  2. This will create Wrike tasks for all products in Google Sheets');
	console.log('  3. Stock will be managed in Wrike from now on\n');
}

async function run() {
	try {
		if (!apiToken) {
			console.error('Missing WRIKE_API_TOKEN. Add it to .env and try again.');
			process.exit(1);
		}
		
		if (listFieldsMode) {
			await listCustomFields();
			return;
		}
		
		if (listMode) {
			await listFolders();
			return;
		}
		
		await validateConfig();
	} catch (err) {
		console.error('Error:', err.message);
		if (err.message.includes('401')) {
			console.log('\nYour WRIKE_API_TOKEN may be invalid or expired.');
		}
		process.exit(1);
	}
}

run();
