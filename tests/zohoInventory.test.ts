import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mapZohoItemToProduct, readZohoProducts, resetZohoInventoryCacheForTests, type ZohoInventoryItem } from '../lib/zohoInventory';

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

test('coalesces concurrent catalog reads and serves subsequent reads from cache', async () => {
	const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'puretide-zoho-cache-'));
	const originalFetch = globalThis.fetch;
	const originalEnvironment = {
		accessToken: process.env.ZOHO_INVENTORY_ACCESS_TOKEN,
		organizationId: process.env.ZOHO_INVENTORY_ORGANIZATION_ID,
		apiBaseUrl: process.env.ZOHO_INVENTORY_API_BASE_URL,
		cachePath: process.env.ZOHO_INVENTORY_CACHE_PATH,
		catalogCacheTtl: process.env.ZOHO_INVENTORY_CATALOG_CACHE_TTL_MS,
	};
	let requestCount = 0;
	let rateLimited = false;

	try {
		process.env.ZOHO_INVENTORY_ACCESS_TOKEN = 'test-access-token';
		process.env.ZOHO_INVENTORY_ORGANIZATION_ID = 'test-organization';
		process.env.ZOHO_INVENTORY_API_BASE_URL = 'https://inventory.example.test/v1';
		process.env.ZOHO_INVENTORY_CACHE_PATH = path.join(temporaryDirectory, 'catalog.json');
		process.env.ZOHO_INVENTORY_CATALOG_CACHE_TTL_MS = '60000';
		resetZohoInventoryCacheForTests();

		globalThis.fetch = (async (input) => {
			requestCount += 1;
			if (rateLimited) return Response.json({ code: 45, message: 'Daily API limit exceeded' }, { status: 429 });
			const url = new URL(String(input));
			if (url.pathname.endsWith('/items')) {
				return Response.json({
					code: 0,
					items: [
						{
							item_id: 'item-1',
							name: 'Bacteriostatic Water',
							rate: 10.99,
							stock_on_hand: 44,
							custom_fields: customFields(),
						},
					],
					page_context: { has_more_page: false },
				});
			}
			if (url.pathname.endsWith('/items/item-1')) {
				return Response.json({
					code: 0,
					item: {
						item_id: 'item-1',
						name: 'Bacteriostatic Water',
						rate: 10.99,
						stock_on_hand: 44,
						custom_fields: customFields(),
					},
				});
			}
			return Response.json({ code: 404, message: 'Not found' }, { status: 404 });
		}) as typeof fetch;

		const [first, second] = await Promise.all([readZohoProducts(), readZohoProducts()]);
		const third = await readZohoProducts();

		assert.equal(requestCount, 2);
		assert.equal(first[0]?.stock, 44);
		assert.deepEqual(second, first);
		assert.deepEqual(third, first);

		process.env.ZOHO_INVENTORY_CATALOG_CACHE_TTL_MS = '1';
		await new Promise((resolve) => setTimeout(resolve, 5));
		rateLimited = true;
		resetZohoInventoryCacheForTests();
		const stale = await readZohoProducts();
		assert.equal(requestCount, 3);
		assert.deepEqual(JSON.parse(JSON.stringify(stale)), JSON.parse(JSON.stringify(first)));
	} finally {
		globalThis.fetch = originalFetch;
		const restore = (key: string, value: string | undefined) => {
			if (value == null) delete process.env[key];
			else process.env[key] = value;
		};
		restore('ZOHO_INVENTORY_ACCESS_TOKEN', originalEnvironment.accessToken);
		restore('ZOHO_INVENTORY_ORGANIZATION_ID', originalEnvironment.organizationId);
		restore('ZOHO_INVENTORY_API_BASE_URL', originalEnvironment.apiBaseUrl);
		restore('ZOHO_INVENTORY_CACHE_PATH', originalEnvironment.cachePath);
		restore('ZOHO_INVENTORY_CATALOG_CACHE_TTL_MS', originalEnvironment.catalogCacheTtl);
		resetZohoInventoryCacheForTests();
		await rm(temporaryDirectory, { recursive: true, force: true });
	}
});
