import 'dotenv/config';
import { syncZohoStockSheet } from '../lib/zohoStockSheetSync';

syncZohoStockSheet()
	.then((result) => {
		console.log(JSON.stringify({ ok: true, ...result }, null, 2));
	})
	.catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
