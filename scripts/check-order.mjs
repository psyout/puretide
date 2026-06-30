import dotenv from 'dotenv';

dotenv.config();

const { getOrderByOrderNumberFromDb } = await import('../lib/ordersDb.ts');

const orderNumber = process.argv[2];
if (!orderNumber) {
	console.error('Usage: npx tsx scripts/check-order.mjs <orderNumber>');
	process.exit(1);
}

const order = await getOrderByOrderNumberFromDb(orderNumber);
if (!order) {
	console.error(`Order not found: ${orderNumber}`);
	process.exit(1);
}

console.log('Order Number:', order.orderNumber);
console.log('Payment Status:', order.paymentStatus);
console.log('Payment Method:', order.paymentMethod);
console.log('Total:', order.total);
console.log('Paid At:', order.paidAt || 'Not paid');
console.log('E-Transfer:', JSON.stringify(order.etransfer, null, 2));
console.log('Fulfillment Status:', JSON.stringify(order.fulfillmentStatus, null, 2));
