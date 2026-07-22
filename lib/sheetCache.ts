import { readSheetProducts, readSheetPromoCodes, readSheetClients, readSheetFriendsFamilyAllowlist, readSheetPromotionCampaigns } from './stockSheet';
import type { FriendsFamilySheetEntry } from './stockSheet';
import type { PromotionCampaign } from '@/types/product';

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
const friendsFamilyCache = new Map<string, CachedEntry<any>>();
const promotionCampaignCache = new Map<string, CachedEntry<any>>();

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

function isPromotionInSchedule(campaign: PromotionCampaign, now: Date): boolean {
	if (!campaign.active || campaign.tiers.length === 0) return false;
	if (campaign.startDate) {
		const start = new Date(campaign.startDate);
		if (!Number.isNaN(start.getTime()) && now < start) return false;
	}
	if (campaign.endDate) {
		const end = new Date(campaign.endDate);
		if (!Number.isNaN(end.getTime()) && now > end) return false;
	}
	return true;
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

// Promotion campaign caching
export async function getCachedSheetPromotionCampaigns(): Promise<PromotionCampaign[]> {
	const cacheKey = 'promotion-campaigns';
	const cached = getFromCache(promotionCampaignCache, cacheKey);
	if (cached) return cached;

	try {
		const campaigns = await readSheetPromotionCampaigns();
		setCache(promotionCampaignCache, cacheKey, campaigns, PROMO_CACHE_TTL_MS);
		return campaigns;
	} catch (error) {
		const staleEntry = promotionCampaignCache.get(cacheKey);
		if (staleEntry) {
			console.warn('Using stale promotion campaign cache due to fetch error:', error);
			return staleEntry.data;
		}
		throw error;
	}
}

export async function getCachedActivePromotionCampaign(): Promise<PromotionCampaign | null> {
	const campaigns = await getCachedSheetPromotionCampaigns();
	const now = new Date();
	return campaigns.find((campaign) => isPromotionInSchedule(campaign, now)) ?? null;
}

// Friends & Family allowlist caching
export async function getCachedSheetFriendsFamilyAllowlist(): Promise<FriendsFamilySheetEntry[]> {
	const cacheKey = 'friends-family';
	const cached = getFromCache(friendsFamilyCache, cacheKey);
	if (cached) return cached;

	try {
		const entries = await readSheetFriendsFamilyAllowlist();
		setCache(friendsFamilyCache, cacheKey, entries, PROMO_CACHE_TTL_MS);
		return entries;
	} catch (error) {
		// If cache has stale data, return it as fallback
		const staleEntry = friendsFamilyCache.get(cacheKey);
		if (staleEntry) {
			console.warn('Using stale Friends & Family cache due to fetch error:', error);
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
			getCachedSheetFriendsFamilyAllowlist(),
			getCachedSheetPromotionCampaigns(),
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

export function invalidateFriendsFamilyCache() {
	friendsFamilyCache.clear();
}

export function invalidatePromotionCampaignCache() {
	promotionCampaignCache.clear();
}

export function invalidateAllCaches() {
	productCache.clear();
	promoCache.clear();
	clientCache.clear();
	friendsFamilyCache.clear();
	promotionCampaignCache.clear();
}
