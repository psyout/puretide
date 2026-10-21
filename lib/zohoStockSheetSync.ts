import { syncZohoStockToSheet } from '@/lib/stockSheet';
import { readZohoStockSnapshot } from '@/lib/zohoInventory';

export async function syncZohoStockSheet() {
	const stock = await readZohoStockSnapshot();
	return syncZohoStockToSheet(stock);
}
