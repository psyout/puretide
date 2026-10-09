import axios from 'axios';

type WrikeTask = {
	id?: string;
	title?: string;
	description?: string;
	createdDate?: string;
	status?: string;
	completedDate?: string;
	customFields?: Array<{ id?: string; value?: unknown }>;
};

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';

const parseMoney = (value: string | undefined) => {
	if (!value) return undefined;
	const parsed = Number(value.replace(/,/g, ''));
	return Number.isFinite(parsed) ? parsed : undefined;
};

const stripHtml = (value: string) =>
	value
		.replace(/<br\s*\/?\s*>/gi, '\n')
		.replace(/<[^>]*>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.trim();

export function parseWrikeAffiliateOrder(
	task: WrikeTask,
	paymentStatusFieldId = String(process.env.WRIKE_PAYMENT_STATUS_FIELD_ID ?? '').trim(),
): Record<string, unknown> | null {
	const description = String(task.description ?? '');
	const discountMatch = description.match(/Discount\s*\(([^)]+)\)\s*:\s*-\$([\d,.]+)/i);
	if (!discountMatch) return null;
	const orderNumber = String(task.title ?? '').match(/Order\s*#([a-z0-9-]+)/i)?.[1];
	if (!orderNumber || !task.createdDate) return null;

	const subtotal = parseMoney(description.match(/(?:^|>)Subtotal:\s*\$([\d,.]+)/i)?.[1]);
	const total = parseMoney(description.match(/<b>Total:\s*\$([\d,.]+)/i)?.[1]);
	const discountAmount = parseMoney(discountMatch[2]);
	if (subtotal === undefined || total === undefined || discountAmount === undefined) return null;

	const titleName = String(task.title ?? '').match(/Order\s*#[a-z0-9-]+\s*-\s*(.+)$/i)?.[1];
	const wrikePaymentStatus = String(task.customFields?.find((field) => field.id === paymentStatusFieldId)?.value ?? '')
		.trim()
		.toLowerCase();
	const transferConfirmed = Boolean(paymentStatusFieldId) && wrikePaymentStatus === 'transferred';
	const descriptionConfirmsPayment = /(?:PAID\s*[·-]|Payment confirmed|<b>Status:<\/b>\s*Confirmed)/i.test(description);
	const paymentStatus = transferConfirmed || descriptionConfirmsPayment ? 'paid' : 'pending';
	return {
		id: `wrike_${task.id ?? orderNumber}`,
		orderNumber,
		createdAt: task.createdDate,
		paymentStatus,
		promoCode: discountMatch[1].trim().toUpperCase(),
		subtotal,
		discountAmount,
		total,
		customer: { firstName: titleName ? stripHtml(titleName) : 'Customer', lastName: '' },
		orderSource: 'wrike',
	};
}

export async function listWrikeAffiliateOrders(): Promise<Array<Record<string, unknown>>> {
	const apiToken = process.env.WRIKE_API_TOKEN;
	const ordersFolderId = process.env.WRIKE_ORDERS_FOLDER_ID;
	if (!apiToken || !ordersFolderId) return [];

	const tasks: WrikeTask[] = [];
	let nextPageToken: string | undefined;
	do {
		const params: Record<string, string | boolean> = {
			descendants: true,
			fields: JSON.stringify(['description', 'customFields']),
		};
		if (nextPageToken) params.nextPageToken = nextPageToken;
		const response = await axios.get(`${WRIKE_API_BASE}/folders/${ordersFolderId}/tasks`, {
			headers: { Authorization: `Bearer ${apiToken}` },
			params,
			timeout: 15_000,
		});
		const data = response.data as { data?: WrikeTask[]; nextPageToken?: string };
		tasks.push(...(data.data ?? []));
		nextPageToken = data.nextPageToken;
	} while (nextPageToken);

	return tasks.map((task) => parseWrikeAffiliateOrder(task)).filter((order): order is Record<string, unknown> => order !== null);
}

export function mergeAffiliateOrderSources(
	databaseOrders: Array<Record<string, unknown>>,
	wrikeOrders: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
	const byOrderNumber = new Map<string, Record<string, unknown>>();
	for (const order of wrikeOrders) byOrderNumber.set(String(order.orderNumber ?? order.id ?? ''), order);
	for (const databaseOrder of databaseOrders) {
		const key = String(databaseOrder.orderNumber ?? databaseOrder.id ?? '');
		const wrikeOrder = byOrderNumber.get(key);
		byOrderNumber.set(key, {
			...wrikeOrder,
			...databaseOrder,
			promoCode: databaseOrder.promoCode || wrikeOrder?.promoCode,
			subtotal: databaseOrder.subtotal ?? wrikeOrder?.subtotal,
			discountAmount: databaseOrder.discountAmount ?? wrikeOrder?.discountAmount,
			total: databaseOrder.total ?? wrikeOrder?.total,
		});
	}
	return Array.from(byOrderNumber.values());
}
