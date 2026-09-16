import type { Product } from '@/types/product';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

type ZohoCustomField = {
	label?: string;
	api_name?: string;
	value?: unknown;
	value_formatted?: unknown;
};

export type ZohoInventoryItem = {
	item_id?: string | number;
	name?: string;
	sku?: string;
	status?: string;
	rate?: string | number;
	purchase_rate?: string | number;
	stock_on_hand?: string | number;
	available_stock?: string | number;
	actual_available_stock?: string | number;
	locations?: Array<{
		status?: string;
		location_stock_on_hand?: string | number;
		location_available_stock?: string | number;
		location_actual_available_stock?: string | number;
	}>;
	custom_fields?: ZohoCustomField[];
	[key: string]: unknown;
};

type ZohoItemsResponse = {
	code?: number;
	message?: string;
	items?: ZohoInventoryItem[];
	page_context?: { has_more_page?: boolean };
};

type ZohoItemResponse = {
	code?: number;
	message?: string;
	item?: ZohoInventoryItem;
};

type ZohoTokenResponse = {
	access_token?: string;
	expires_in?: number;
	error?: string;
	error_description?: string;
};

type ZohoApiResponse = {
	code?: number;
	message?: string;
};

export type StockDeductionItem = {
	id: string;
	name?: string;
	quantity: number;
};

let cachedAccessToken: { value: string; expiresAt: number } | null = null;
type ProductCatalogCache = { products: Product[]; refreshedAt: number; expiresAt: number };
type ItemDetailCache = { item: ZohoInventoryItem; expiresAt: number };

let cachedProductCatalog: ProductCatalogCache | null = null;
let pendingProductCatalogRead: Promise<Product[]> | null = null;
let persistentCatalogLoaded = false;
const cachedItemDetails = new Map<string, ItemDetailCache>();

const DEFAULT_CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_ITEM_DETAIL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const positiveDuration = (value: unknown, fallback: number) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getCatalogCacheTtlMs = () => positiveDuration(process.env.ZOHO_INVENTORY_CATALOG_CACHE_TTL_MS, DEFAULT_CATALOG_CACHE_TTL_MS);
const getItemDetailCacheTtlMs = () => positiveDuration(process.env.ZOHO_INVENTORY_DETAIL_CACHE_TTL_MS, DEFAULT_ITEM_DETAIL_CACHE_TTL_MS);
const getPersistentCachePath = () => {
	const configuredPath = process.env.ZOHO_INVENTORY_CACHE_PATH?.trim();
	if (configuredPath) return configuredPath;
	const ordersDatabasePath = process.env.ORDERS_DB_PATH?.trim();
	if (ordersDatabasePath) return path.join(path.dirname(ordersDatabasePath), 'zoho-products-cache.json');
	return path.join(process.cwd(), 'data', 'zoho-products-cache.json');
};

const cloneProducts = (products: Product[]) =>
	products.map((product) => ({
		...product,
		...(product.icons ? { icons: [...product.icons] } : {}),
		...(product.variants ? { variants: product.variants.map((variant) => ({ ...variant })) } : {}),
	}));

async function loadPersistentCatalog() {
	if (persistentCatalogLoaded) return;
	persistentCatalogLoaded = true;
	try {
		const payload = JSON.parse(await readFile(getPersistentCachePath(), 'utf8')) as { refreshedAt?: unknown; products?: unknown };
		const refreshedAt = Number(payload.refreshedAt);
		if (!Number.isFinite(refreshedAt) || !Array.isArray(payload.products) || payload.products.length === 0) return;
		cachedProductCatalog = {
			products: payload.products as Product[],
			refreshedAt,
			expiresAt: refreshedAt + getCatalogCacheTtlMs(),
		};
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
			console.warn(JSON.stringify({ label: 'zoho:catalog_cache:load_failed', message: error instanceof Error ? error.message : String(error) }));
		}
	}
}

async function persistCatalog(cache: ProductCatalogCache) {
	try {
		const cachePath = getPersistentCachePath();
		await mkdir(path.dirname(cachePath), { recursive: true });
		const temporaryPath = `${cachePath}.${process.pid}.tmp`;
		await writeFile(temporaryPath, JSON.stringify({ version: 1, refreshedAt: cache.refreshedAt, products: cache.products }), { mode: 0o600 });
		await rename(temporaryPath, cachePath);
	} catch (error) {
		console.warn(JSON.stringify({ label: 'zoho:catalog_cache:persist_failed', message: error instanceof Error ? error.message : String(error) }));
	}
}

const canonicalize = (value: unknown) =>
	String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');

const asTrimmedString = (value: unknown) => String(value ?? '').trim();

const asFiniteNumber = (value: unknown): number | null => {
	const normalized = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
	if (normalized === '' || normalized == null) return null;
	const number = Number(normalized);
	return Number.isFinite(number) ? number : null;
};

const normalizeWebsiteStatus = (value: unknown): NonNullable<Product['status']> => {
	switch (asTrimmedString(value).toLowerCase()) {
		case 'published':
		case 'active':
			return 'published';
		case 'draft':
			return 'draft';
		case 'stock-out':
		case 'stock out':
			return 'stock-out';
		case 'inactive':
		default:
			return 'inactive';
	}
};

const getCustomField = (item: ZohoInventoryItem, label: string): string => {
	const target = canonicalize(label);
	const directValue = item[`cf_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`];
	if (directValue != null && asTrimmedString(directValue)) return asTrimmedString(directValue);

	const field = item.custom_fields?.find((candidate) => canonicalize(candidate.label) === target || canonicalize(candidate.api_name) === target || canonicalize(candidate.api_name) === `cf${target}`);
	return asTrimmedString(field?.value ?? field?.value_formatted);
};

const getStockOnHand = (item: ZohoInventoryItem): number => {
	const direct = asFiniteNumber(item.stock_on_hand) ?? asFiniteNumber(item.actual_available_stock) ?? asFiniteNumber(item.available_stock);
	if (direct != null) return Math.max(0, Math.round(direct));

	const activeLocations = (item.locations ?? []).filter((location) => String(location.status ?? 'active').toLowerCase() === 'active');
	const locationStocks = activeLocations
		.map((location) => asFiniteNumber(location.location_stock_on_hand) ?? asFiniteNumber(location.location_actual_available_stock) ?? asFiniteNumber(location.location_available_stock))
		.filter((value): value is number => value != null);
	if (locationStocks.length === 0) return 0;
	return Math.max(0, Math.round(locationStocks.reduce((sum, value) => sum + value, 0)));
};

const normalizeCoaFile = (value: string): string | undefined => {
	if (!value || value.toUpperCase() === 'N/A') return undefined;
	try {
		const url = new URL(value);
		const filename = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '');
		return filename || undefined;
	} catch {
		return value.includes('/') || value.includes('\\') ? undefined : value;
	}
};

export function mapZohoItemToProduct(item: ZohoInventoryItem): Product | null {
	const slug = getCustomField(item, 'Website Slug');
	if (!slug) return null;

	const name = asTrimmedString(item.name);
	const description = getCustomField(item, 'Website Description');
	const category = getCustomField(item, 'Website Category');
	const price = asFiniteNumber(item.rate);
	const zohoItemId = asTrimmedString(item.item_id);
	const missingFields = [
		...(!zohoItemId ? ['Item ID'] : []),
		...(!name ? ['Item Name'] : []),
		...(!description ? ['Website Description'] : []),
		...(!category ? ['Website Category'] : []),
		...(price == null ? ['Selling Price'] : []),
	];
	if (missingFields.length > 0) {
		throw new Error(`Zoho item ${zohoItemId || name || slug} is missing required website data: ${missingFields.join(', ')}.`);
	}

	const icons = getCustomField(item, 'Website Icons')
		.split(',')
		.map((icon) => icon.trim())
		.filter(Boolean);
	const subtitle = getCustomField(item, 'Website Subtitle');
	const details = getCustomField(item, 'Website Details');
	const strength = getCustomField(item, 'Strength');
	const purity = getCustomField(item, 'Purity');
	const coaFile = normalizeCoaFile(getCustomField(item, 'COA File'));
	const displayOrder = asFiniteNumber(getCustomField(item, 'Website Sort Order'));

	return {
		id: slug,
		slug,
		zohoItemId,
		sku: asTrimmedString(item.sku) || undefined,
		name,
		description,
		price: price!,
		stock: getStockOnHand(item),
		image: getCustomField(item, 'Website Image'),
		category,
		icons,
		status: normalizeWebsiteStatus(getCustomField(item, 'Website Status')),
		...(displayOrder != null ? { displayOrder } : {}),
		...(subtitle ? { subtitle } : {}),
		...(details ? { details } : {}),
		...(strength ? { mg: strength } : {}),
		...(purity ? { purity } : {}),
		...(coaFile ? { coaFile } : {}),
		...(asFiniteNumber(item.purchase_rate) != null ? { cost: asFiniteNumber(item.purchase_rate) ?? undefined } : {}),
	};
}

function getApiBaseUrl() {
	return String(process.env.ZOHO_INVENTORY_API_BASE_URL ?? 'https://www.zohoapis.com/inventory/v1').replace(/\/+$/, '');
}

function getOrganizationId() {
	const organizationId = asTrimmedString(process.env.ZOHO_INVENTORY_ORGANIZATION_ID);
	if (!organizationId) throw new Error('ZOHO_INVENTORY_ORGANIZATION_ID is required when PRODUCT_SOURCE=zoho.');
	return organizationId;
}

async function getAccessToken(): Promise<string> {
	const fixedToken = asTrimmedString(process.env.ZOHO_INVENTORY_ACCESS_TOKEN);
	if (fixedToken) return fixedToken;
	if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) return cachedAccessToken.value;

	const clientId = asTrimmedString(process.env.ZOHO_INVENTORY_CLIENT_ID);
	const clientSecret = asTrimmedString(process.env.ZOHO_INVENTORY_CLIENT_SECRET);
	const refreshToken = asTrimmedString(process.env.ZOHO_INVENTORY_REFRESH_TOKEN);
	if (!clientId || !clientSecret || !refreshToken) {
		throw new Error('Zoho Inventory OAuth is not configured. Set an access token or the client ID, client secret, and refresh token.');
	}

	const accountsBase = String(process.env.ZOHO_ACCOUNTS_BASE_URL ?? 'https://accounts.zoho.com').replace(/\/+$/, '');
	const body = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		refresh_token: refreshToken,
		grant_type: 'refresh_token',
	});
	const response = await fetch(`${accountsBase}/oauth/v2/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
		cache: 'no-store',
	});
	const payload = (await response.json()) as ZohoTokenResponse;
	if (!response.ok || !payload.access_token) {
		throw new Error(`Zoho OAuth refresh failed: ${payload.error_description || payload.error || response.statusText}`);
	}

	const expiresInSeconds = Math.max(60, Number(payload.expires_in ?? 3600));
	cachedAccessToken = { value: payload.access_token, expiresAt: Date.now() + Math.max(30, expiresInSeconds - 120) * 1000 };
	return cachedAccessToken.value;
}

async function zohoRequest<T extends ZohoApiResponse>(path: string, init?: RequestInit, query?: Record<string, string>): Promise<T> {
	const url = new URL(`${getApiBaseUrl()}/${path.replace(/^\/+/, '')}`);
	url.searchParams.set('organization_id', getOrganizationId());
	for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
	const token = await getAccessToken();
	const response = await fetch(url, {
		...init,
		headers: {
			Accept: 'application/json',
			Authorization: `Zoho-oauthtoken ${token}`,
			...(init?.body ? { 'Content-Type': 'application/json' } : {}),
			...(init?.headers ?? {}),
		},
		cache: 'no-store',
	});
	const payload = (await response.json()) as T;
	if (!response.ok || (typeof payload.code === 'number' && payload.code !== 0)) {
		throw new Error(`Zoho Inventory request failed (${response.status}): ${payload.message || response.statusText}`);
	}
	return payload;
}

async function refreshZohoProducts(): Promise<Product[]> {
	const websiteItems: ZohoInventoryItem[] = [];
	for (let page = 1; page <= 100; page += 1) {
		const response = await zohoRequest<ZohoItemsResponse>('items', undefined, { page: String(page), per_page: '200' });
		for (const item of response.items ?? []) {
			if (getCustomField(item, 'Website Slug')) websiteItems.push(item);
		}
		if (!response.page_context?.has_more_page) break;
		if (page === 100) throw new Error('Zoho Inventory pagination exceeded 100 pages.');
	}
	if (websiteItems.length === 0) throw new Error('Zoho Inventory returned no items with a Website Slug.');

	const products: Product[] = [];
	const batchSize = 5;
	for (let index = 0; index < websiteItems.length; index += batchSize) {
		const batch = websiteItems.slice(index, index + batchSize);
		const detailedItems = await Promise.all(
			batch.map(async (summary) => {
				const itemId = asTrimmedString(summary.item_id);
				if (!itemId) throw new Error(`Zoho item ${getCustomField(summary, 'Website Slug')} is missing its Item ID.`);
				let detail = cachedItemDetails.get(itemId);
				if (!detail || detail.expiresAt <= Date.now()) {
					const response = await zohoRequest<ZohoItemResponse>(`items/${encodeURIComponent(itemId)}`);
					if (!response.item) throw new Error(`Zoho Inventory returned no details for item ${itemId}.`);
					detail = { item: response.item, expiresAt: Date.now() + getItemDetailCacheTtlMs() };
					cachedItemDetails.set(itemId, detail);
				}
				return {
					...detail.item,
					...summary,
					custom_fields: [...(summary.custom_fields ?? []), ...(detail.item.custom_fields ?? [])],
				};
			}),
		);

		for (const item of detailedItems) {
			const product = mapZohoItemToProduct(item);
			if (product) products.push(product);
		}
	}
	return products.sort((left, right) => {
		const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
		const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;
		return leftOrder - rightOrder;
	});
}

export async function readZohoProducts(): Promise<Product[]> {
	await loadPersistentCatalog();
	if (cachedProductCatalog && cachedProductCatalog.expiresAt > Date.now()) return cloneProducts(cachedProductCatalog.products);
	if (pendingProductCatalogRead) return cloneProducts(await pendingProductCatalogRead);

	pendingProductCatalogRead = (async () => {
		try {
			const products = await refreshZohoProducts();
			const refreshedAt = Date.now();
			cachedProductCatalog = { products, refreshedAt, expiresAt: refreshedAt + getCatalogCacheTtlMs() };
			await persistCatalog(cachedProductCatalog);
			return products;
		} catch (error) {
			if (cachedProductCatalog?.products.length) {
				console.warn(
					JSON.stringify({
						label: 'zoho:catalog_cache:using_stale',
						refreshedAt: new Date(cachedProductCatalog.refreshedAt).toISOString(),
						message: error instanceof Error ? error.message : String(error),
					}),
				);
				return cachedProductCatalog.products;
			}
			throw error;
		} finally {
			pendingProductCatalogRead = null;
		}
	})();

	return cloneProducts(await pendingProductCatalogRead);
}

export function resetZohoInventoryCacheForTests() {
	cachedAccessToken = null;
	cachedProductCatalog = null;
	pendingProductCatalogRead = null;
	persistentCatalogLoaded = false;
	cachedItemDetails.clear();
}

export function isZohoInventoryWriteEnabled() {
	return String(process.env.ZOHO_INVENTORY_WRITE_ENABLED ?? '').trim().toLowerCase() === 'true';
}

export async function decrementZohoStock(orderNumber: string, items: StockDeductionItem[]): Promise<void> {
	if (!isZohoInventoryWriteEnabled()) {
		if (process.env.NODE_ENV === 'production') throw new Error('Zoho Inventory stock writes are disabled.');
		console.info(JSON.stringify({ label: 'fulfillment:zoho:dry_run', orderNumber, items }));
		return;
	}

	const products = await readZohoProducts();
	const productsBySlug = new Map(products.map((product) => [product.slug, product]));
	const adjustmentAccountId = asTrimmedString(process.env.ZOHO_INVENTORY_ADJUSTMENT_ACCOUNT_ID);
	if (!adjustmentAccountId) throw new Error('ZOHO_INVENTORY_ADJUSTMENT_ACCOUNT_ID is required when Zoho stock writes are enabled.');
	const locationId = asTrimmedString(process.env.ZOHO_INVENTORY_LOCATION_ID);

	const lineItems = items.map((item) => {
		const product = productsBySlug.get(asTrimmedString(item.id));
		const quantity = Number(item.quantity);
		if (!product?.zohoItemId) throw new Error(`Zoho product not found for website slug: ${item.id}`);
		if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Invalid quantity for ${item.id}: ${item.quantity}`);
		if (quantity > product.stock) throw new Error(`Insufficient Zoho stock for ${product.name}. Available: ${product.stock}, requested: ${quantity}.`);
		return {
			item_id: product.zohoItemId,
			name: product.name,
			quantity_adjusted: -quantity,
			adjustment_account_id: adjustmentAccountId,
			...(locationId ? { location_id: locationId } : {}),
		};
	});

	const date = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.TZ || 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
	await zohoRequest('inventoryadjustments', {
		method: 'POST',
		body: JSON.stringify({
			date,
			reason: 'Website order',
			description: `Automatic stock deduction for website order ${orderNumber}`,
			reference_number: `WEB-${orderNumber}`,
			adjustment_type: 'quantity',
			...(locationId ? { location_id: locationId } : {}),
			line_items: lineItems,
		}),
	});

	if (cachedProductCatalog) {
		const quantities = new Map(items.map((item) => [asTrimmedString(item.id), Number(item.quantity)]));
		cachedProductCatalog = {
			...cachedProductCatalog,
			products: cachedProductCatalog.products.map((product) => {
				const quantity = quantities.get(product.slug);
				return quantity ? { ...product, stock: Math.max(0, product.stock - quantity) } : product;
			}),
		};
		await persistCatalog(cachedProductCatalog);
	}
}
