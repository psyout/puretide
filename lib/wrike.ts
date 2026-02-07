const WRIKE_API_BASE = 'https://www.wrike.com/api/v4';

type WrikeConfig = {
	apiToken: string;
	ordersFolderId: string;
	stockAlertsFolderId: string;
};

function getWrikeConfig(): WrikeConfig | null {
	const apiToken = process.env.WRIKE_API_TOKEN;
	const ordersFolderId = process.env.WRIKE_ORDERS_FOLDER_ID;
	const stockAlertsFolderId = process.env.WRIKE_STOCK_ALERTS_FOLDER_ID;

	if (!apiToken || !ordersFolderId || !stockAlertsFolderId) {
		return null;
	}

	return { apiToken, ordersFolderId, stockAlertsFolderId };
}

async function createTask(folderId: string, title: string, description: string, apiToken: string) {
	const response = await fetch(`${WRIKE_API_BASE}/folders/${folderId}/tasks`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			title,
			description,
			status: 'Active',
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		console.error('Wrike API error:', error);
		return null;
	}

	const data = await response.json();
	return data.data?.[0] ?? null;
}

type OrderData = {
	orderNumber: string;
	createdAt: string;
	customer: {
		firstName: string;
		lastName: string;
		email: string;
		phone: string;
		address: string;
		addressLine2: string;
		city: string;
		province: string;
		zipCode: string;
		country: string;
		orderNotes: string;
	};
	shipToDifferentAddress: boolean;
	shippingAddress?: {
		address: string;
		addressLine2: string;
		city: string;
		province: string;
		zipCode: string;
	};
	shippingMethod: 'regular' | 'express';
	subtotal: number;
	shippingCost: number;
	discountAmount?: number;
	promoCode?: string;
	total: number;
	cartItems: Array<{
		name: string;
		price: number;
		quantity: number;
	}>;
};

export async function createOrderTask(order: OrderData) {
	const config = getWrikeConfig();
	if (!config) {
		console.log('Wrike not configured, skipping task creation');
		return null;
	}

	const title = `Order #${order.orderNumber} - ${order.customer.firstName} ${order.customer.lastName}`;
	
	const shippingAddr = order.shipToDifferentAddress && order.shippingAddress
		? order.shippingAddress
		: order.customer;

	const itemsList = order.cartItems
		.map(item => `• ${item.name} × ${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`)
		.join('\n');

	const description = `
**Order #${order.orderNumber}**
Date: ${new Date(order.createdAt).toLocaleString('en-CA')}

---

**Customer Information**
Name: ${order.customer.firstName} ${order.customer.lastName}
Email: ${order.customer.email}
Phone: ${order.customer.phone}

**Billing Address**
${order.customer.address}
${order.customer.addressLine2 ? order.customer.addressLine2 + '\n' : ''}${order.customer.city}, ${order.customer.province} ${order.customer.zipCode}
${order.customer.country}

**Shipping Address**
${shippingAddr.address}
${shippingAddr.addressLine2 ? shippingAddr.addressLine2 + '\n' : ''}${shippingAddr.city}, ${shippingAddr.province} ${shippingAddr.zipCode}

---

**Order Items**
${itemsList}

---

**Order Summary**
Subtotal: $${order.subtotal.toFixed(2)}
Shipping (${order.shippingMethod}): $${order.shippingCost.toFixed(2)}
${order.discountAmount ? `Discount${order.promoCode ? ` (${order.promoCode})` : ''}: -$${order.discountAmount.toFixed(2)}\n` : ''}**Total: $${order.total.toFixed(2)}**

---

${order.customer.orderNotes ? `**Order Notes**\n${order.customer.orderNotes}` : ''}

**Status: NEW ORDER - AWAITING PAYMENT**
	`.trim();

	try {
		const task = await createTask(config.ordersFolderId, title, description, config.apiToken);
		if (task) {
			console.log('Wrike order task created:', task.id);
		}
		return task;
	} catch (error) {
		console.error('Failed to create Wrike order task:', error);
		return null;
	}
}

export async function createStockAlertTask(items: Array<{ name: string; slug: string; stock: number }>) {
	const config = getWrikeConfig();
	if (!config || items.length === 0) {
		return null;
	}

	const title = `Low Stock Alert - ${items.length} item${items.length > 1 ? 's' : ''} need restocking`;
	
	const itemsList = items
		.map(item => `• **${item.name}** (${item.slug}) - Only ${item.stock} left`)
		.join('\n');

	const description = `
**Low Stock Alert**
Date: ${new Date().toLocaleString('en-CA')}

The following items have stock levels at or below 5 units:

${itemsList}

---

**Action Required:** Restock these items soon to avoid stockouts.
	`.trim();

	try {
		const task = await createTask(config.stockAlertsFolderId, title, description, config.apiToken);
		if (task) {
			console.log('Wrike stock alert task created:', task.id);
		}
		return task;
	} catch (error) {
		console.error('Failed to create Wrike stock alert task:', error);
		return null;
	}
}
