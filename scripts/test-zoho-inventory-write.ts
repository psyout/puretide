import { config } from 'dotenv';
import { decrementZohoStock, readZohoProducts } from '../lib/zohoInventory';

config({ path: '.env.local' });
config();

const testSlug = 'bacteriostatic-water';
const expectedStartingStock = 44;

const getProduct = async () => {
	const product = (await readZohoProducts()).find((candidate) => candidate.slug === testSlug);
	if (!product?.zohoItemId) throw new Error(`Zoho product not found for website slug: ${testSlug}`);
	return product;
};

const getAccessToken = async () => {
	const accountsBase = String(process.env.ZOHO_ACCOUNTS_BASE_URL ?? '').replace(/\/+$/, '');
	const response = await fetch(`${accountsBase}/oauth/v2/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: String(process.env.ZOHO_INVENTORY_CLIENT_ID ?? ''),
			client_secret: String(process.env.ZOHO_INVENTORY_CLIENT_SECRET ?? ''),
			refresh_token: String(process.env.ZOHO_INVENTORY_REFRESH_TOKEN ?? ''),
			grant_type: 'refresh_token',
		}),
		cache: 'no-store',
	});
	const payload = (await response.json()) as { access_token?: string; error?: string };
	if (!response.ok || !payload.access_token) throw new Error(`Zoho OAuth refresh failed: ${payload.error ?? response.statusText}`);
	return payload.access_token;
};

const restoreOneUnit = async (itemId: string, itemName: string, reference: string) => {
	const apiBase = String(process.env.ZOHO_INVENTORY_API_BASE_URL ?? '').replace(/\/+$/, '');
	const organizationId = String(process.env.ZOHO_INVENTORY_ORGANIZATION_ID ?? '');
	const adjustmentAccountId = String(process.env.ZOHO_INVENTORY_ADJUSTMENT_ACCOUNT_ID ?? '');
	const accessToken = await getAccessToken();
	const date = new Intl.DateTimeFormat('en-CA', {
		timeZone: process.env.TZ || 'America/Vancouver',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(new Date());
	const url = new URL(`${apiBase}/inventoryadjustments`);
	url.searchParams.set('organization_id', organizationId);
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			Authorization: `Zoho-oauthtoken ${accessToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			date,
			reason: 'Website order',
			description: `Reversal for controlled website stock test ${reference}`,
			reference_number: `${reference}-RESTORE`,
			adjustment_type: 'quantity',
			line_items: [
				{
					item_id: itemId,
					name: itemName,
					quantity_adjusted: 1,
					adjustment_account_id: adjustmentAccountId,
				},
			],
		}),
		cache: 'no-store',
	});
	const payload = (await response.json()) as { code?: number; message?: string; inventory_adjustment?: { inventory_adjustment_id?: string } };
	if (!response.ok || payload.code !== 0) throw new Error(`Zoho stock restoration failed (${response.status}): ${payload.message ?? response.statusText}`);
	return payload.inventory_adjustment?.inventory_adjustment_id ?? null;
};

async function main() {
	if (String(process.env.ZOHO_INVENTORY_WRITE_ENABLED ?? '').toLowerCase() !== 'false') {
		throw new Error('Safety check failed: ZOHO_INVENTORY_WRITE_ENABLED must be false in .env.local before running this test.');
	}

	const before = await getProduct();
	const itemId = before.zohoItemId;
	if (!itemId) throw new Error(`Safety check failed: ${testSlug} has no Zoho Item ID. No adjustment was created.`);
	if (before.stock !== expectedStartingStock) {
		throw new Error(`Safety check failed: expected ${testSlug} stock ${expectedStartingStock}, received ${before.stock}. No adjustment was created.`);
	}

	const reference = `CODEX-STOCK-TEST-${Date.now()}`;
	const previousWriteSetting = process.env.ZOHO_INVENTORY_WRITE_ENABLED;
	let decrementApplied = false;
	let afterDecrementStock: number | null = null;
	let restorationAdjustmentId: string | null = null;

	try {
		process.env.ZOHO_INVENTORY_WRITE_ENABLED = 'true';
		await decrementZohoStock(reference, [{ id: testSlug, name: before.name, quantity: 1 }]);
		decrementApplied = true;
		const afterDecrement = await getProduct();
		afterDecrementStock = afterDecrement.stock;
		if (afterDecrement.stock !== before.stock - 1) {
			throw new Error(`Zoho decrement verification failed: expected ${before.stock - 1}, received ${afterDecrement.stock}.`);
		}
	} finally {
		try {
			if (decrementApplied) restorationAdjustmentId = await restoreOneUnit(itemId, before.name, reference);
		} finally {
			process.env.ZOHO_INVENTORY_WRITE_ENABLED = previousWriteSetting;
		}
	}

	const finalProduct = await getProduct();
	if (finalProduct.stock !== before.stock) {
		throw new Error(`Zoho restoration verification failed: expected ${before.stock}, received ${finalProduct.stock}.`);
	}

	console.log(
		JSON.stringify(
			{
				result: 'passed',
				product: before.name,
				reference,
				beforeStock: before.stock,
				afterDecrementStock,
				finalStock: finalProduct.stock,
				restorationAdjustmentId,
				persistentWriteSetting: process.env.ZOHO_INVENTORY_WRITE_ENABLED,
			},
			null,
			2,
		),
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
