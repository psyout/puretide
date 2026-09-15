import test from 'node:test';
import assert from 'node:assert/strict';
import { mapZohoItemToProduct, type ZohoInventoryItem } from '../lib/zohoInventory';

const customFields = (overrides: Record<string, string> = {}) =>
	Object.entries({
		'Website Slug': 'bacteriostatic-water',
		'Website Status': 'published',
		'Website Subtitle': 'Laboratory reconstitution water',
		'Website Description': 'Short description',
		'Website Details': 'Long details',
		'Website Category': 'Accessory',
		'Website Image': '/bottles/v16.webp',
		'Website Icons': 'Hydration, Immune',
		'Website Sort Order': '27',
		Strength: '10 mL',
		Purity: 'N/A',
		'COA File': 'https://example.com/coa/bacteriostatic-water.pdf',
		...overrides,
	}).map(([label, value]) => ({ label, value }));

test('maps a Zoho Inventory item to the website product contract', () => {
	const item: ZohoInventoryItem = {
		item_id: '126485000000023127',
		name: 'Bacteriostatic Water',
		sku: 'BW10',
		rate: '10.99',
		purchase_rate: '4.50',
		stock_on_hand: '44',
		custom_fields: customFields(),
	};

	const product = mapZohoItemToProduct(item);
	assert.ok(product);
	assert.deepEqual(product, {
		id: 'bacteriostatic-water',
		slug: 'bacteriostatic-water',
		zohoItemId: '126485000000023127',
		sku: 'BW10',
		name: 'Bacteriostatic Water',
		subtitle: 'Laboratory reconstitution water',
		description: 'Short description',
		details: 'Long details',
		icons: ['Hydration', 'Immune'],
		price: 10.99,
		stock: 44,
		image: '/bottles/v16.webp',
		category: 'Accessory',
		mg: '10 mL',
		purity: 'N/A',
		coaFile: 'bacteriostatic-water.pdf',
		status: 'published',
		displayOrder: 27,
		cost: 4.5,
	});
});

test('ignores Zoho-only items without a website slug', () => {
	const item: ZohoInventoryItem = {
		item_id: 'internal-1',
		name: 'Internal supply',
		rate: 1,
		custom_fields: customFields({ 'Website Slug': '' }),
	};

	assert.equal(mapZohoItemToProduct(item), null);
});

test('defaults an empty website status to inactive', () => {
	const item: ZohoInventoryItem = {
		item_id: 'draft-1',
		name: 'Draft product',
		rate: 20,
		stock_on_hand: 3,
		custom_fields: customFields({ 'Website Slug': 'draft-product', 'Website Status': '' }),
	};

	assert.equal(mapZohoItemToProduct(item)?.status, 'inactive');
});

test('sums active location stock when item-level stock is absent', () => {
	const item: ZohoInventoryItem = {
		item_id: 'location-1',
		name: 'Location product',
		rate: 20,
		locations: [
			{ status: 'active', location_stock_on_hand: 10 },
			{ status: 'active', location_stock_on_hand: 7 },
			{ status: 'inactive', location_stock_on_hand: 99 },
		],
		custom_fields: customFields({ 'Website Slug': 'location-product' }),
	};

	assert.equal(mapZohoItemToProduct(item)?.stock, 17);
});
