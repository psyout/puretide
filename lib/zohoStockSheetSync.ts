import { syncZohoStockToInventorySheet } from '@/lib/stockSheet';
import { readZohoInventoryItemSnapshot } from '@/lib/zohoInventory';

export async function syncZohoStockSheet() {
	const stock = await readZohoInventoryItemSnapshot();
	return syncZohoStockToInventorySheet(stock);
}
