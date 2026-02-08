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
			Authorization: `Bearer ${apiToken}`,
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
	paymentMethod: 'etransfer' | 'creditcard';
	cardFee?: number;
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
	stockLevels?: Array<{
		name: string;
		stock: number;
	}>;
};

export async function createOrderTask(order: OrderData) {
	const config = getWrikeConfig();
	if (!config) {
		console.log('Wrike not configured, skipping task creation');
		return null;
	}

	const title = `Order #${order.orderNumber} - ${order.customer.firstName} ${order.customer.lastName}`;

	const shippingAddr = order.shipToDifferentAddress && order.shippingAddress ? order.shippingAddress : order.customer;

	const itemsList = order.cartItems.map((item) => `<li>${item.name} × ${item.quantity} - $${(item.price * item.quantity).toFixed(2)}</li>`).join('');

	const stockList = order.stockLevels?.length
		? order.stockLevels
				.map((item) => {
					const isLow = item.stock <= 5;
					return `<li>${item.name}: <b style="${isLow ? 'color:red' : ''}">${item.stock} units</b>${isLow ? ' ⚠️ LOW' : ''}</li>`;
				})
				.join('')
		: '';

	const description = `
<h3>Order #${order.orderNumber}</h3>
<p>Date: ${new Date(order.createdAt).toLocaleString('en-CA')}</p>
<hr>
<h4>Customer Information</h4>
<p>
<b>Name:</b> ${order.customer.firstName} ${order.customer.lastName}<br>
<b>Email:</b> ${order.customer.email}<br>
</p>
<h4>Billing Address</h4>
<p>
${order.customer.address}<br>
${order.customer.addressLine2 ? order.customer.addressLine2 + '<br>' : ''}${order.customer.city}, ${order.customer.province} ${order.customer.zipCode}<br>
${order.customer.country}
</p>
<h4>Shipping Address</h4>
<p>
${shippingAddr.address}<br>
${shippingAddr.addressLine2 ? shippingAddr.addressLine2 + '<br>' : ''}${shippingAddr.city}, ${shippingAddr.province} ${shippingAddr.zipCode}
</p>
<hr>
<h4>Order Items</h4>
<ul>${itemsList}</ul>
<hr>
<h4>Payment Method</h4>
<p><b>${order.paymentMethod === 'creditcard' ? '💳 Credit Card' : '🏦 E-Transfer (Interac)'}</b></p>
<hr>
<h4>Order Summary</h4>
<p>
Subtotal: $${order.subtotal.toFixed(2)}<br>
Shipping (${order.shippingMethod}): $${order.shippingCost.toFixed(2)}<br>
${order.cardFee ? `Card Fee (5%): $${order.cardFee.toFixed(2)}<br>` : ''}${order.discountAmount ? `Discount${order.promoCode ? ` (${order.promoCode})` : ''}: -$${order.discountAmount.toFixed(2)}<br>` : ''}<b>Total: $${order.total.toFixed(2)}</b>
</p>
${stockList ? `<hr><h4>Stock Remaining</h4><ul>${stockList}</ul>` : ''}
${order.customer.orderNotes ? `<hr><h4>Order Notes</h4><p>${order.customer.orderNotes}</p>` : ''}
<hr>
<p><b>Status: NEW ORDER - AWAITING PAYMENT</b></p>
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

	const itemsList = items.map((item) => `<li><b>${item.name}</b> (${item.slug}) - Only ${item.stock} left</li>`).join('');

	const description = `
<h3>Low Stock Alert</h3>
<p>Date: ${new Date().toLocaleString('en-CA')}</p>
<p>The following items have stock levels at or below 5 units:</p>
<ul>${itemsList}</ul>
<hr>
<p><b>Action Required:</b> Restock these items soon to avoid stockouts.</p>
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
