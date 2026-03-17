import { readSheetProducts, readSheetPromoCodes, readSheetClients } from './stockSheet';

// Cache TTL: 5 minutes for products, 10 minutes for promos/clients
const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;
const PROMO_CACHE_TTL_MS = 10 * 60 * 1000;

type CachedEntry<T> = {
	data: T;
	expiresAt: number;
};

const productCache = new Map<string, CachedEntry<any>>();
const promoCache = new Map<string, CachedEntry<any>>();
const clientCache = new Map<string, CachedEntry<any>>();

function isExpired(entry: CachedEntry<any>): boolean {
	return Date.now() > entry.expiresAt;
}

function getFromCache<T>(cache: Map<string, CachedEntry<T>>, key: string): T | null {
	const entry = cache.get(key);
	if (!entry || isExpired(entry)) {
		cache.delete(key);
		return null;
	}
	return entry.data;
}

function setCache<T>(cache: Map<string, CachedEntry<T>>, key: string, data: T, ttlMs: number): void {
	cache.set(key, {
		data,
		expiresAt: Date.now() + ttlMs,
	});
}

// Product caching
export async function getCachedSheetProducts() {
	const cacheKey = 'products';
	const cached = getFromCache(productCache, cacheKey);
	if (cached) return cached;

	try {
		const products = await readSheetProducts();
		setCache(productCache, cacheKey, products, PRODUCT_CACHE_TTL_MS);
		return products;
	} catch (error) {
		// If cache has stale data, return it as fallback
		const staleEntry = productCache.get(cacheKey);
		if (staleEntry) {
			console.warn('Using stale product cache due to fetch error:', error);
			return staleEntry.data;
		}
		throw error;
	}
}

// Promo code caching
export async function getCachedSheetPromoCodes() {
	const cacheKey = 'promos';
	const cached = getFromCache(promoCache, cacheKey);
	if (cached) return cached;

	try {
		const promos = await readSheetPromoCodes();
		setCache(promoCache, cacheKey, promos, PROMO_CACHE_TTL_MS);
		return promos;
	} catch (error) {
		// If cache has stale data, return it as fallback
		const staleEntry = promoCache.get(cacheKey);
		if (staleEntry) {
			console.warn('Using stale promo cache due to fetch error:', error);
			return staleEntry.data;
		}
		throw error;
	}
}

// Client caching
export async function getCachedSheetClients() {
	const cacheKey = 'clients';
	const cached = getFromCache(clientCache, cacheKey);
	if (cached) return cached;

	try {
		const clients = await readSheetClients();
		setCache(clientCache, cacheKey, clients, PROMO_CACHE_TTL_MS);
		return clients;
	} catch (error) {
		// If cache has stale data, return it as fallback
		const staleEntry = clientCache.get(cacheKey);
		if (staleEntry) {
			console.warn('Using stale client cache due to fetch error:', error);
			return staleEntry.data;
		}
		throw error;
	}
}

// Cache warming function (call during app startup)
export async function warmCaches() {
	try {
		await Promise.all([
			getCachedSheetProducts(),
			getCachedSheetPromoCodes(),
			getCachedSheetClients(),
		]);
		console.log('Cache warming completed');
	} catch (error) {
		console.warn('Cache warming failed:', error);
	}
}

// Cache invalidation functions
export function invalidateProductCache() {
	productCache.clear();
}

export function invalidatePromoCache() {
	promoCache.clear();
}

export function invalidateClientCache() {
	clientCache.clear();
}

export function invalidateAllCaches() {
	productCache.clear();
	promoCache.clear();
	clientCache.clear();
}
