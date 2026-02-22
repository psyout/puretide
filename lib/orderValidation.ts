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
	if (first.length > MAX_LENGTH.firstName) return 'First name is too long.';
	if (!last) return 'Last name is required.';
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

export type CartItemForStock = { id: number; name?: string; quantity: number };

export async function validateStockAvailability(
	cartItems: CartItemForStock[],
	getProducts: () => Promise<Array<{ id: string; slug?: string; stock: number; name?: string }>>
): Promise<string | null> {
	const products = await getProducts();
	for (const item of cartItems) {
		const product = products.find(
			(p) => String(item.id) === p.id || String(item.id) === p.slug
		);
		if (!product) {
			return `Product "${item.name ?? item.id}" is not available.`;
		}
		const available = Number(product.stock) || 0;
		if (item.quantity > available) {
			return `Insufficient stock for "${product.name ?? product.id}". Available: ${available}, requested: ${item.quantity}.`;
		}
	}
	return null;
}
