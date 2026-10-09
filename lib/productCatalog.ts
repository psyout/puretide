import { readZohoProducts } from '@/lib/zohoInventory';

export async function readProducts() {
	return readZohoProducts();
}
