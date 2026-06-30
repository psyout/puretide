import dotenv from 'dotenv';

dotenv.config();

const { getOrderByOrderNumberFromDb, upsertOrderInDb } = await import('../lib/ordersDb.ts');

const orderNumber = process.argv[2];
const newStatus = process.argv[3] || 'pending';

if (!orderNumber) {
	console.error('Usage: npx tsx scripts/reset-order-status.mjs <orderNumber> [status]');
	process.exit(1);
}

const order = await getOrderByOrderNumberFromDb(orderNumber);
if (!order) {
	console.error(`Order not found: ${orderNumber}`);
	process.exit(1);
}

await upsertOrderInDb({
	...order,
	paymentStatus: newStatus,
	paidAt: newStatus === 'paid' ? order.paidAt : null,
});

console.log(`Order ${orderNumber} reset to status: ${newStatus}`);
