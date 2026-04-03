import type { Product } from '@/types/product';

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';

type WrikeConfig = {
	apiToken: string;
	productsFolderId: string;
};

function getWrikeConfig(): WrikeConfig | null {
	const apiToken = process.env.WRIKE_API_TOKEN;
	const productsFolderId = process.env.WRIKE_PRODUCTS_FOLDER_ID;

	if (!apiToken || !productsFolderId) {
		return null;
	}

	return { apiToken, productsFolderId };
}

export type ProductInventory = {
	productId: string;
	stock: number;
	cost: number;
	supplier?: string;
	supplierSku?: string;
	reorderPoint?: number;
	reorderQuantity?: number;
	lastRestocked?: string;
	wrikeTaskId: string;
};

type CustomFieldInput = { id: string; value: string };

type WrikeTask = {
	id: string;
	title: string;
	description?: string;
	customFields?: Array<{ id: string; value: string }>;
};

type SyncResult = {
	created: number;
	skipped: number;
	errors: string[];
};

async function getTasksInFolder(folderId: string, apiToken: string): Promise<WrikeTask[]> {
	const response = await fetch(`${WRIKE_API_BASE}/folders/${folderId}/tasks`, {
		headers: { Authorization: `Bearer ${apiToken}` },
	});
	if (!response.ok) return [];
	const data = await response.json();
	return data.data ?? [];
}

async function createTask(folderId: string, title: string, description: string, apiToken: string, customFields?: CustomFieldInput[]): Promise<WrikeTask | null> {
	const body: Record<string, unknown> = { title, description, status: 'Active' };
	if (Array.isArray(customFields) && customFields.length > 0) {
		body.customFields = customFields;
	}

	const response = await fetch(`${WRIKE_API_BASE}/folders/${folderId}/tasks`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const error = await response.text();
		console.error('[WrikeProducts] API error:', response.status, error);
		return null;
	}

	const data = await response.json();
	return data.data?.[0] ?? null;
}

async function updateTask(taskId: string, updates: { title?: string; description?: string; customFields?: CustomFieldInput[] }, apiToken: string): Promise<WrikeTask | null> {
	const body: Record<string, unknown> = {};
	if (updates.title !== undefined) body.title = updates.title;
	if (updates.description !== undefined) body.description = updates.description;
	if (Array.isArray(updates.customFields) && updates.customFields.length > 0) body.customFields = updates.customFields;

	const response = await fetch(`${WRIKE_API_BASE}/tasks/${taskId}`, {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const error = await response.text();
		console.error('[WrikeProducts] API update error:', response.status, error);
		return null;
	}

	const data = await response.json();
	return data.data?.[0] ?? null;
}

function parseProductInventoryFromTask(task: WrikeTask): ProductInventory | null {
	const customFields = task.customFields ?? [];
	
	const productIdField = process.env.WRIKE_PRODUCT_ID_FIELD_ID;
	const stockField = process.env.WRIKE_STOCK_FIELD_ID;
	const costField = process.env.WRIKE_COST_FIELD_ID;
	const supplierField = process.env.WRIKE_SUPPLIER_FIELD_ID;
	const supplierSkuField = process.env.WRIKE_SUPPLIER_SKU_FIELD_ID;
	const reorderPointField = process.env.WRIKE_REORDER_POINT_FIELD_ID;
	const reorderQtyField = process.env.WRIKE_REORDER_QTY_FIELD_ID;

	const productId = customFields.find((f) => f.id === productIdField)?.value;
	if (!productId) return null;

	const stock = Number(customFields.find((f) => f.id === stockField)?.value ?? 0);
	const cost = Number(customFields.find((f) => f.id === costField)?.value ?? 0);
	const supplier = customFields.find((f) => f.id === supplierField)?.value;
	const supplierSku = customFields.find((f) => f.id === supplierSkuField)?.value;
	const reorderPoint = Number(customFields.find((f) => f.id === reorderPointField)?.value ?? 5);
	const reorderQuantity = Number(customFields.find((f) => f.id === reorderQtyField)?.value ?? 0);

	return {
		productId,
		stock,
		cost,
		supplier,
		supplierSku,
		reorderPoint,
		reorderQuantity,
		wrikeTaskId: task.id,
	};
}

export async function getAllProductInventory(): Promise<ProductInventory[]> {
	const config = getWrikeConfig();
	if (!config) {
		console.warn('[WrikeProducts] Not configured. Missing WRIKE_API_TOKEN or WRIKE_PRODUCTS_FOLDER_ID');
		return [];
	}

	try {
		const tasks = await getTasksInFolder(config.productsFolderId, config.apiToken);
		const inventory = tasks.map(parseProductInventoryFromTask).filter((inv): inv is ProductInventory => inv !== null);
		return inventory;
	} catch (error) {
		console.error('[WrikeProducts] Failed to fetch inventory:', error);
		return [];
	}
}

export async function getProductInventory(productId: string): Promise<ProductInventory | null> {
	const allInventory = await getAllProductInventory();
	return allInventory.find((inv) => inv.productId === productId) ?? null;
}

export async function createProductTask(product: { id: string; name: string; stock?: number; cost?: number }): Promise<WrikeTask | null> {
	const config = getWrikeConfig();
	if (!config) {
		console.warn('[WrikeProducts] Not configured');
		return null;
	}

	const customFields: CustomFieldInput[] = [];
	
	if (process.env.WRIKE_PRODUCT_ID_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_PRODUCT_ID_FIELD_ID, value: product.id });
	}
	if (process.env.WRIKE_STOCK_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_STOCK_FIELD_ID, value: String(product.stock ?? 0) });
	}
	if (process.env.WRIKE_COST_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_COST_FIELD_ID, value: String(product.cost ?? 0) });
	}
	if (process.env.WRIKE_REORDER_POINT_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_REORDER_POINT_FIELD_ID, value: '5' });
	}

	const description = `<p>Product ID: ${product.id}</p><p>Inventory managed via Wrike</p>`;
	
	try {
		const task = await createTask(config.productsFolderId, product.name, description, config.apiToken, customFields);
		if (task) {
			console.log('[WrikeProducts] Created product task:', task.id, 'for product:', product.id);
		}
		return task;
	} catch (error) {
		console.error('[WrikeProducts] Failed to create product task:', error);
		return null;
	}
}

export async function updateProductStock(productId: string, newStock: number): Promise<boolean> {
	const config = getWrikeConfig();
	if (!config) return false;

	const inventory = await getProductInventory(productId);
	if (!inventory) {
		console.warn('[WrikeProducts] Product not found in Wrike:', productId);
		return false;
	}

	const stockFieldId = process.env.WRIKE_STOCK_FIELD_ID;
	if (!stockFieldId) {
		console.warn('[WrikeProducts] WRIKE_STOCK_FIELD_ID not configured');
		return false;
	}

	try {
		const updated = await updateTask(
			inventory.wrikeTaskId,
			{
				customFields: [{ id: stockFieldId, value: String(newStock) }],
			},
			config.apiToken
		);
		
		if (updated) {
			console.log('[WrikeProducts] Updated stock for product:', productId, 'to:', newStock);
			return true;
		}
		return false;
	} catch (error) {
		console.error('[WrikeProducts] Failed to update stock:', error);
		return false;
	}
}

export async function decrementStock(productId: string, quantity: number): Promise<boolean> {
	const inventory = await getProductInventory(productId);
	if (!inventory) {
		console.warn('[WrikeProducts] Cannot decrement stock - product not found:', productId);
		return false;
	}

	const newStock = Math.max(0, inventory.stock - quantity);
	return updateProductStock(productId, newStock);
}

export async function updateProductInventory(productId: string, updates: Partial<Omit<ProductInventory, 'productId' | 'wrikeTaskId'>>): Promise<boolean> {
	const config = getWrikeConfig();
	if (!config) return false;

	const inventory = await getProductInventory(productId);
	if (!inventory) {
		console.warn('[WrikeProducts] Product not found in Wrike:', productId);
		return false;
	}

	const customFields: CustomFieldInput[] = [];

	if (updates.stock !== undefined && process.env.WRIKE_STOCK_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_STOCK_FIELD_ID, value: String(updates.stock) });
	}
	if (updates.cost !== undefined && process.env.WRIKE_COST_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_COST_FIELD_ID, value: String(updates.cost) });
	}
	if (updates.supplier !== undefined && process.env.WRIKE_SUPPLIER_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_SUPPLIER_FIELD_ID, value: updates.supplier });
	}
	if (updates.supplierSku !== undefined && process.env.WRIKE_SUPPLIER_SKU_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_SUPPLIER_SKU_FIELD_ID, value: updates.supplierSku });
	}
	if (updates.reorderPoint !== undefined && process.env.WRIKE_REORDER_POINT_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_REORDER_POINT_FIELD_ID, value: String(updates.reorderPoint) });
	}
	if (updates.reorderQuantity !== undefined && process.env.WRIKE_REORDER_QTY_FIELD_ID) {
		customFields.push({ id: process.env.WRIKE_REORDER_QTY_FIELD_ID, value: String(updates.reorderQuantity) });
	}

	if (customFields.length === 0) return true;

	try {
		const updated = await updateTask(inventory.wrikeTaskId, { customFields }, config.apiToken);
		if (updated) {
			console.log('[WrikeProducts] Updated inventory for product:', productId);
			return true;
		}
		return false;
	} catch (error) {
		console.error('[WrikeProducts] Failed to update inventory:', error);
		return false;
	}
}

export async function syncNewProductsFromSheets(sheetProducts: Product[]): Promise<SyncResult> {
	const config = getWrikeConfig();
	if (!config) {
		return { created: 0, skipped: 0, errors: ['Wrike not configured'] };
	}

	const existingInventory = await getAllProductInventory();
	const existingProductIds = new Set(existingInventory.map((inv) => inv.productId));

	const newProducts = sheetProducts.filter((p) => !existingProductIds.has(p.id));

	const result: SyncResult = { created: 0, skipped: 0, errors: [] };

	for (const product of newProducts) {
		try {
			const task = await createProductTask({
				id: product.id,
				name: product.name,
				stock: 0,
				cost: 0,
			});

			if (task) {
				result.created++;
				console.log('[WrikeProducts] Synced new product:', product.id, product.name);
			} else {
				result.errors.push(`Failed to create task for ${product.id}`);
			}
		} catch (error) {
			result.errors.push(`Error creating ${product.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	result.skipped = sheetProducts.length - newProducts.length;

	if (result.created > 0) {
		console.log(`[WrikeProducts] Sync complete: ${result.created} created, ${result.skipped} skipped`);
	}

	return result;
}

export async function getProductsBelowReorderPoint(): Promise<ProductInventory[]> {
	const allInventory = await getAllProductInventory();
	return allInventory.filter((inv) => {
		const reorderPoint = inv.reorderPoint ?? 5;
		return inv.stock <= reorderPoint;
	});
}
