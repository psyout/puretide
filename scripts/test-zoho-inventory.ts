import { config } from 'dotenv';
import { readZohoProducts } from '../lib/zohoInventory';

config({ path: '.env.local' });
config();

async function main() {
	const products = await readZohoProducts();
	const published = products.filter((product) => product.status === 'published');
	const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
	const missingWebsiteData = products.filter(
		(product) => !product.slug || !product.name || !product.description || !product.category || !product.image,
	);
	const missingSortOrder = products.filter((product) => product.displayOrder == null);
	const sortOrders = products.map((product) => product.displayOrder).filter((value): value is number => value != null);

	console.log(
		JSON.stringify(
			{
				mode: 'read-only',
				products: products.length,
				published: published.length,
				totalStock,
				missingWebsiteData: missingWebsiteData.map((product) => product.slug),
				missingSortOrder: missingSortOrder.map((product) => product.slug),
				sortOrderIsUnique: new Set(sortOrders).size === sortOrders.length,
				sample: products.slice(0, 5).map((product) => ({
					slug: product.slug,
					name: product.name,
					stock: product.stock,
					price: product.price,
					status: product.status,
				})),
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
