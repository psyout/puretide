#!/usr/bin/env node

// Safe local-only Google Sheets stock decrement test.
// - Reads current Total Stock via readSheetProducts()
// - Writes decremented Total Stock via writeSheetProducts()
// - Re-reads to verify
// - Restores original Total Stock immediately
//
// This script does NOT:
// - send emails
// - create Wrike tasks
// - touch orders DB

try {
	const dotenv = await import('dotenv');
	dotenv.config();
} catch {
	// dotenv optional
}

function parseArgs() {
	const args = process.argv.slice(2);
	const out = { productId: '', qty: 1 };
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === '--product' || a === '-p') {
			out.productId = String(args[i + 1] ?? '');
			i++;
			continue;
		}
		if (a === '--qty' || a === '-q') {
			out.qty = Number(args[i + 1] ?? 1);
			i++;
			continue;
		}
	}
	if (!out.productId) throw new Error('Missing --product <productId>');
	if (!Number.isFinite(out.qty) || out.qty <= 0) throw new Error('Invalid --qty, must be > 0');
	return out;
}

async function getProductStock(productId) {
	const { readSheetProducts } = await import('../lib/stockSheet.ts');
	const products = await readSheetProducts();
	const p = products.find((x) => String(x.id) === String(productId));
	if (!p) {
		throw new Error(`Product not found in sheet products list: ${productId}`);
	}
	return { product: p, products };
}

async function writeProducts(products) {
	const { writeSheetProducts } = await import('../lib/stockSheet.ts');
	await writeSheetProducts(products);
}

async function main() {
	const { productId, qty } = parseArgs();
	const orderNumber = `local_sheets_test_${Date.now()}`;

	console.log(JSON.stringify({ label: 'local:sheets_test:start', orderNumber, productId, qty }));

	const before = await getProductStock(productId);
	const oldStock = Number(before.product.stock ?? 0);
	if (!Number.isFinite(oldStock)) throw new Error(`Old stock is not a number for ${productId}: ${String(before.product.stock)}`);
	if (!Number.isInteger(oldStock)) {
		console.warn(JSON.stringify({ label: 'local:sheets_test:warn_non_integer_old_stock', productId, oldStock }));
	}

	const newStock = Math.max(0, oldStock - qty);
	console.log(
		JSON.stringify({
			label: 'local:sheets_test:deduct',
			productId,
			oldTotalStock: oldStock,
			quantityDeducted: qty,
			newTotalStock: newStock,
		}),
	);

	// Apply decrement in-memory and write
	const updatedProducts = before.products.map((p) => (String(p.id) === String(productId) ? { ...p, stock: newStock } : p));
	await writeProducts(updatedProducts);
	console.log(JSON.stringify({ label: 'local:sheets_test:write_decremented:ok', productId }));

	// Re-read to verify
	const after = await getProductStock(productId);
	const afterStock = Number(after.product.stock ?? 0);
	console.log(JSON.stringify({ label: 'local:sheets_test:verify', productId, expected: newStock, actual: afterStock }));
	if (afterStock !== newStock) {
		throw new Error(`Verification failed. Expected ${newStock}, got ${afterStock}`);
	}
	if (!Number.isInteger(afterStock)) {
		throw new Error(`Verification failed. Stock is not an integer after write: ${afterStock}`);
	}

	// Restore original
	const restoreProducts = after.products.map((p) => (String(p.id) === String(productId) ? { ...p, stock: oldStock } : p));
	await writeProducts(restoreProducts);
	console.log(JSON.stringify({ label: 'local:sheets_test:restore_write:ok', productId, restoredTo: oldStock }));

	const restored = await getProductStock(productId);
	const restoredStock = Number(restored.product.stock ?? 0);
	console.log(JSON.stringify({ label: 'local:sheets_test:restore_verify', productId, expected: oldStock, actual: restoredStock }));
	if (restoredStock !== oldStock) {
		throw new Error(`Restore verification failed. Expected ${oldStock}, got ${restoredStock}`);
	}
	if (!Number.isInteger(restoredStock)) {
		throw new Error(`Restore verification failed. Stock is not an integer after restore: ${restoredStock}`);
	}

	console.log(JSON.stringify({ label: 'local:sheets_test:success', orderNumber, productId }));
}

main().catch((err) => {
	console.error(JSON.stringify({ label: 'local:sheets_test:error', message: err?.message ?? String(err) }));
	console.error(err);
	process.exit(1);
});
