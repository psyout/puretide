import { products as fallbackProducts } from '@/lib/products';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LENGTH = {
	firstName: 100,
	lastName: 100,
	email: 254,
	address: 500,
	addressLine2: 200,
	city: 100,
	province: 100,
	zipCode: 20,
	orderNotes: 2000,
};

export type CustomerInput = {
	firstName?: string;
	lastName?: string;
	country?: string;
	email?: string;
	address?: string;
	addressLine2?: string;
	city?: string;
	province?: string;
	zipCode?: string;
	orderNotes?: string;
};

export function validateCustomer(customer: CustomerInput): string | null {
	if (!customer || typeof customer !== 'object') return 'Invalid customer data';

	const first = (customer.firstName ?? '').trim();
	const last = (customer.lastName ?? '').trim();
	const email = (customer.email ?? '').trim();
	const address = (customer.address ?? '').trim();
	const city = (customer.city ?? '').trim();
	const province = (customer.province ?? '').trim();
	const zipCode = (customer.zipCode ?? '').trim();

	if (!first) return 'First name is required.';
	if (first.length < 3) return 'First name must be at least 3 characters for card payments. If your name is shorter, please use your full first name.';
	if (first.length > MAX_LENGTH.firstName) return 'First name is too long.';
	if (!last) return 'Last name is required.';
	if (last.length < 3) return 'Last name must be at least 3 characters for card payments. If your name is shorter, please use your full last name.';
	if (last.length > MAX_LENGTH.lastName) return 'Last name is too long.';
	if (!email) return 'Email is required.';
	if (!EMAIL_REGEX.test(email)) return 'Please enter a valid email address.';
	if (email.length > MAX_LENGTH.email) return 'Email is too long.';
	if (!address) return 'Address is required.';
	if (address.length > MAX_LENGTH.address) return 'Address is too long.';
	if ((customer.addressLine2 ?? '').length > MAX_LENGTH.addressLine2) return 'Address line 2 is too long.';
	if (!city) return 'City is required.';
	if (city.length > MAX_LENGTH.city) return 'City is too long.';
	if (!province) return 'Province is required.';
	if (province.length > MAX_LENGTH.province) return 'Province is too long.';
	if (!zipCode) return 'Postal code is required.';
	if (zipCode.length > MAX_LENGTH.zipCode) return 'Postal code is too long.';
	const orderNotes = (customer.orderNotes ?? '').trim();
	if (orderNotes.length > MAX_LENGTH.orderNotes) return 'Order notes are too long.';

	return null;
}

export type ShippingAddressInput = {
	address?: string;
	addressLine2?: string;
	city?: string;
	province?: string;
	zipCode?: string;
};

export function validateShippingAddress(addr: ShippingAddressInput | null | undefined): string | null {
	if (!addr || typeof addr !== 'object') return 'Shipping address is required when shipping to a different address.';
	const address = (addr.address ?? '').trim();
	const city = (addr.city ?? '').trim();
	const province = (addr.province ?? '').trim();
	const zipCode = (addr.zipCode ?? '').trim();
	if (!address) return 'Shipping address is required.';
	if (address.length > MAX_LENGTH.address) return 'Shipping address is too long.';
	if ((addr.addressLine2 ?? '').length > MAX_LENGTH.addressLine2) return 'Shipping address line 2 is too long.';
	if (!city) return 'Shipping city is required.';
	if (city.length > MAX_LENGTH.city) return 'Shipping city is too long.';
	if (!province) return 'Shipping province is required.';
	if (province.length > MAX_LENGTH.province) return 'Shipping province is too long.';
	if (!zipCode) return 'Shipping postal code is required.';
	if (zipCode.length > MAX_LENGTH.zipCode) return 'Shipping postal code is too long.';
	return null;
}

export type CartItemForStock = { id: string; name?: string; quantity: number };

function normalizeKey(value: string) {
	return String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ' ');
}

function resolveProductForCartItem(
	products: Array<{ id: string; slug?: string; stock: number; name?: string; variants?: Array<{ key: string; stock: number }> }>,
	item: CartItemForStock,
): { product: { id: string; slug?: string; stock: number; name?: string; variants?: Array<{ key: string; stock: number }> } | null; resolvedId: string } {
	const itemId = String(item.id);

	// 1) Canonical: exact match by product id/slug
	const direct = products.find((p) => itemId === p.id || itemId === p.slug);
	if (direct) return { product: direct, resolvedId: direct.id };

	// 2) Back-compat: numeric IDs from legacy baseProducts -> resolve by slug
	const legacy = fallbackProducts.find((p) => String(p.id) === itemId);
	if (legacy?.slug) {
		const bySlug = products.find((p) => legacy.slug === p.id || legacy.slug === p.slug);
		if (bySlug) return { product: bySlug, resolvedId: bySlug.id };
	}

	// 3) Temporary back-compat: match by normalized name
	const itemName = item.name ? normalizeKey(item.name) : '';
	if (itemName) {
		const byName = products.find((p) => p.name && normalizeKey(p.name) === itemName);
		if (byName) return { product: byName, resolvedId: byName.id };
	}

	return { product: null, resolvedId: itemId };
}

export async function validateStockAvailability(
	cartItems: CartItemForStock[],
	getProducts: () => Promise<Array<{ id: string; slug?: string; stock: number; name?: string; variants?: Array<{ key: string; stock: number }> }>>,
): Promise<string | null> {
	let products = await getProducts();
	// Fallback to base products if Google Sheet returns empty or fails
	if (!products || products.length === 0) {
		console.warn('[validateStockAvailability] Google Sheet returned empty, using fallback products');
		products = fallbackProducts;
	}
	for (const item of cartItems) {
		const itemId = String(item.id);
		let available = 0;
		let productName = item.name ?? item.id;

		// First, resolve product identity (canonical slug + safe back-compat fallbacks)
		const resolved = resolveProductForCartItem(products, item);
		const product = resolved.product;

		if (product) {
			// Regular product found - use its total stock
			available = Number(product.stock) || 0;
			productName = product.name ?? product.id;
		} else if (itemId.includes('-')) {
			// Not found as regular product, try parsing as variant
			// Extract base product ID (all segments except last, for IDs like "MOTS-C-40")
			const parts = itemId.split('-').filter(Boolean);
			const baseId = parts.length > 1 ? parts.slice(0, -1).join('-') : itemId;
			const baseProduct = products.find((p) => p.id === baseId || p.slug === baseId);
			if (!baseProduct) {
				console.error('[validateStockAvailability] Product not found:', { itemId, baseId, availableSlugs: products.map((p) => p.slug) });
				return `Product "${item.name ?? item.id}" is not available.`;
			}
			// Use base product's total stock (source of truth)
			available = Number(baseProduct.stock) || 0;
			productName = baseProduct.name ?? baseProduct.id;
		} else {
			// Not found at all - try partial match (e.g., "bacteriostatic-water-10mg" -> "bacteriostatic-water")
			const partialMatch = products.find((p) => itemId.startsWith(p.id + '-') || itemId.startsWith(p.slug + '-'));
			if (partialMatch) {
				available = Number(partialMatch.stock) || 0;
				productName = partialMatch.name ?? partialMatch.id;
			} else {
				console.error('[validateStockAvailability] Product not found:', { itemId, resolvedId: resolved.resolvedId, availableSlugs: products.map((p) => p.slug) });
				return `Product "${item.name ?? item.id}" is not available.`;
			}
		}

		if (item.quantity > available) {
			return `Insufficient stock for "${productName}". Available: ${available}, requested: ${item.quantity}.`;
		}
	}
	return null;
}
