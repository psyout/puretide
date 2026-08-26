#!/usr/bin/env node

import { config as loadEnv } from 'dotenv';
import { google } from 'googleapis';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const fromArg = process.argv.slice(2).find((arg) => arg.startsWith('--from='))?.slice('--from='.length) ?? '2026-06-30';
const throughArg = process.argv.slice(2).find((arg) => arg.startsWith('--through='))?.slice('--through='.length) ?? new Date().toISOString().slice(0, 10);

const required = ['GOOGLE_SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'WRIKE_API_TOKEN', 'WRIKE_ORDERS_FOLDER_ID'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing configuration: ${missing.join(', ')}`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(fromArg) || !/^\d{4}-\d{2}-\d{2}$/.test(throughArg)) throw new Error('Dates must use YYYY-MM-DD.');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';
const CLIENT_HEADERS = ['Email', 'First Name', 'Last Name', 'Address', 'City', 'Province', 'Zip', 'Country', 'Orders', 'Total Spent', 'Last Order', 'Products', 'How Did You Hear', 'Discount'];

function decodeHtml(value) {
	return String(value ?? '')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&#64;/gi, '@')
		.replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function stripHtml(value) {
	return decodeHtml(value)
		.replace(/<br\s*\/?\s*>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<\/h\d>/gi, '\n')
		.replace(/<[^>]*>/g, '')
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.join('\n');
}

function toIsoDate(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function displayDate(isoDate) {
	const [year, month, day] = isoDate.split('-').map(Number);
	return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Vancouver' }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function parseAddress(description, name) {
	const shipping = description.match(/<h4>\s*Shipping Address\s*<\/h4>([\s\S]*?)(?=<h4>|$)/i);
	const billing = description.match(/<h4>\s*Billing Address\s*<\/h4>([\s\S]*?)(?=<h4>|$)/i);
	const lines = stripHtml(shipping?.[1] ?? billing?.[1] ?? '')
		.split('\n')
		.map((line) => line.replace(/^.*SHIP TO:\s*/i, '').trim())
		.filter(Boolean)
		.filter((line) => line.toLowerCase() !== name.toLowerCase());
	const country = lines.at(-1)?.match(/^(Canada|United States|USA|US)$/i) ? lines.pop() : 'Canada';
	const locality = lines.pop() ?? '';
	const localityMatch =
		locality.match(/^(.+?),\s*(.+?)\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d)$/i) ??
		locality.match(/^(.+?),\s*(.+?)\s+(\d{5}(?:-\d{4})?)$/i);
	return {
		address: lines.join(', '),
		city: localityMatch?.[1]?.trim() ?? '',
		province: localityMatch?.[2]?.trim() ?? '',
		zipCode: localityMatch?.[3]?.trim() ?? '',
		country,
	};
}

function parseOrderTask(task) {
	const description = String(task.description ?? '');
	if (/AWAITING PAYMENT/i.test(description) && !/Shipping Confirmation Sent/i.test(description)) return null;
	const orderMatch = description.match(/Order #([^<\s]+)/i) ?? String(task.title ?? '').match(/^Order #([^\s-]+)/i);
	const emailMatch = description.match(/<b>\s*(?:✉️\s*)?Email:\s*<\/b>\s*([^<]+)/i);
	const dateMatch = description.match(/<p>\s*<b>\s*Date:\s*<\/b>\s*([^<]+)<\/p>/i) ?? description.match(/<p>\s*Date:\s*([^<]+)<\/p>/i);
	const itemsMatch = description.match(/<h4>\s*Order Items\s*<\/h4>\s*<ul>([\s\S]*?)<\/ul>/i);
	const totalMatch = description.match(/<b>\s*Total:\s*\$([0-9,.]+)\s*<\/b>/i);
	if (!orderMatch || !emailMatch || !itemsMatch || !totalMatch) return { error: 'missing required order fields', taskId: task.id, title: task.title, orderDate: toIsoDate(task.createdDate) };

	const orderDate = toIsoDate(dateMatch?.[1] ?? task.createdDate);
	const shippingBlock = description.match(/<h4>\s*Shipping Address\s*<\/h4>([\s\S]*?)(?=<h4>|$)/i)?.[1] ?? '';
	const shippingLines = stripHtml(shippingBlock)
		.split('\n')
		.map((line) => line.replace(/^.*SHIP TO:\s*/i, '').trim())
		.filter(Boolean);
	const legacyName = description.match(/Name:\s*<\/b>\s*([^<]+)/i)?.[1];
	const titleName = String(task.title ?? '').match(/^Order #[^\s-]+\s+-\s+(.+)$/i)?.[1];
	const name = stripHtml(legacyName ?? shippingLines[0] ?? titleName ?? '').trim();
	const [firstName = '', ...lastNameParts] = name.split(/\s+/);
	const address = parseAddress(description, name);
	const products = [...itemsMatch[1].matchAll(/<li>([\s\S]*?)\s*[×x]\s*\d+\s*-\s*\$[0-9,.]+<\/li>/gi)].map((match) => stripHtml(match[1]).trim());
	const discountAmount = Number(description.match(/Discount[^:]*:\s*-\$([0-9,.]+)/i)?.[1]?.replaceAll(',', '') ?? 0);
	const promoCode = stripHtml(description.match(/Discount\s*\(([^)]+)\)/i)?.[1] ?? '').trim();
	const discount = promoCode && discountAmount > 0 ? `${promoCode} (-$${discountAmount.toFixed(2)})` : promoCode || (discountAmount > 0 ? `-$${discountAmount.toFixed(2)}` : '');

	return {
		taskId: task.id,
		orderNumber: stripHtml(orderMatch[1]).trim(),
		orderDate,
		email: stripHtml(emailMatch[1]).trim().toLowerCase(),
		firstName,
		lastName: lastNameParts.join(' '),
		...address,
		total: Number(totalMatch[1].replaceAll(',', '')),
		products,
		discount,
	};
}

async function fetchAllWrikeTasks() {
	const tasks = [];
	let nextPageToken = '';
	do {
		const url = new URL(`${WRIKE_API_BASE}/folders/${process.env.WRIKE_ORDERS_FOLDER_ID}/tasks`);
		url.searchParams.set('descendants', 'true');
		url.searchParams.set('fields', JSON.stringify(['description']));
		if (nextPageToken) url.searchParams.set('nextPageToken', nextPageToken);
		const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.WRIKE_API_TOKEN}` } });
		if (!response.ok) throw new Error(`Wrike API ${response.status}: ${(await response.text()).slice(0, 500)}`);
		const payload = await response.json();
		tasks.push(...(Array.isArray(payload.data) ? payload.data : []));
		nextPageToken = payload.nextPageToken ?? '';
	} while (nextPageToken);
	return tasks;
}

function parseSheetDate(value) {
	const text = String(value ?? '').trim();
	if (!text) return '';
	const iso = text.match(/^\d{4}-\d{2}-\d{2}$/)?.[0];
	return iso ?? toIsoDate(text);
}

function number(value) {
	const parsed = Number(String(value ?? '0').replace(/[$,]/g, ''));
	return Number.isFinite(parsed) ? parsed : 0;
}

const auth = new google.auth.JWT({
	email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
	key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
	scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const sheetResponse = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Clients!A:N' });
const originalRows = sheetResponse.data.values ?? [];
const dataRows = originalRows.slice(1).map((row) => Array.from({ length: 14 }, (_unused, index) => String(row[index] ?? '')));
const sheetDates = dataRows.map((row) => parseSheetDate(row[10])).filter(Boolean).sort();
const latestSheetDate = sheetDates.at(-1) ?? '';
const existingByEmail = new Map(dataRows.map((row) => [row[0].trim().toLowerCase(), row]));

const tasks = await fetchAllWrikeTasks();
const parsed = tasks.map(parseOrderTask);
const parseErrors = parsed.filter((order) => order?.error && order.orderDate >= fromArg && order.orderDate <= throughArg);
const matchingOrders = parsed
	.filter((order) => order && !order.error && order.orderDate >= fromArg && order.orderDate <= throughArg)
	.sort((left, right) => left.orderDate.localeCompare(right.orderDate) || left.orderNumber.localeCompare(right.orderNumber));
const ordersByNumber = new Map();
for (const order of matchingOrders) {
	const group = ordersByNumber.get(order.orderNumber) ?? [];
	group.push(order);
	ordersByNumber.set(order.orderNumber, group);
}
const duplicateGroups = [...ordersByNumber.values()].filter((group) => group.length > 1);
for (const group of duplicateGroups) {
	const signatures = new Set(group.map((order) => JSON.stringify([order.orderDate, order.email, order.total, order.products, order.discount])));
	if (signatures.size > 1) throw new Error(`Duplicate Wrike tasks disagree for order ${group[0].orderNumber}: ${group.map((order) => order.taskId).join(', ')}`);
}
const orders = [...ordersByNumber.values()]
	.map((group) => group[0])
	.sort((left, right) => left.orderDate.localeCompare(right.orderDate) || left.orderNumber.localeCompare(right.orderNumber));
const orderClassifications = orders.map((order) => {
	const existing = existingByEmail.get(order.email);
	if (!existing) return { order, status: 'missing-client' };
	const existingLastOrder = parseSheetDate(existing[10]);
	if (!existingLastOrder || existingLastOrder < order.orderDate) return { order, status: 'newer-order-missing' };
	return { order, status: 'already-represented' };
});
const ordersToApply = orderClassifications.filter(({ status }) => status !== 'already-represented').map(({ order }) => order);
const incompleteOrdersToApply = ordersToApply.filter(
	(order) => !order.firstName || !order.lastName || !order.address || !order.city || !order.province || !order.zipCode || !order.total || !order.products.length,
);
const contactRepairEmails = new Set(
	orders
		.filter((order) => {
			const row = existingByEmail.get(order.email);
			if (!row) return false;
			return [1, 2, 3, 4, 5, 6].some((index) => !row[index]) && Boolean(order.firstName || order.lastName || order.address || order.city || order.province || order.zipCode);
		})
		.map((order) => order.email),
);

console.log(JSON.stringify({
	mode: apply ? 'apply' : 'dry-run',
	from: fromArg,
	through: throughArg,
	sheetClientRows: dataRows.length,
	latestSheetOrderDate: latestSheetDate,
	wrikeTasksScanned: tasks.length,
	wrikeOrderCandidates: orders.length,
	ordersToBackfill: ordersToApply.length,
	alreadyRepresentedInSheet: orderClassifications.filter(({ status }) => status === 'already-represented').length,
	missingClientRows: orderClassifications.filter(({ status }) => status === 'missing-client').length,
	existingClientsMissingNewerOrder: orderClassifications.filter(({ status }) => status === 'newer-order-missing').length,
	clientsNeedingContactRepair: contactRepairEmails.size,
	incompleteOrdersToBackfill: incompleteOrdersToApply.length,
	distinctClients: new Set(orders.map((order) => order.email)).size,
	discountedOrders: orders.filter((order) => order.discount).length,
	parseErrors: parseErrors.length,
	duplicateWrikeOrdersCollapsed: duplicateGroups.length,
	firstOrderDate: orders[0]?.orderDate ?? null,
	lastOrderDate: orders.at(-1)?.orderDate ?? null,
}, null, 2));

if (parseErrors.length) {
	console.log('Unparsed tasks:', parseErrors.slice(0, 20).map((error) => `${error.taskId} (${error.title ?? 'untitled'})`).join(', '));
}
if (duplicateGroups.length) {
	console.log('Duplicate Wrike orders collapsed:', duplicateGroups.map((group) => `${group[0].orderNumber} (${group.length} tasks)`).join(', '));
}
if (incompleteOrdersToApply.length) {
	console.log('Incomplete orders:', incompleteOrdersToApply.map((order) => `${order.orderNumber} (${order.taskId})`).join(', '));
}

if (!apply) process.exit(0);
if (!ordersToApply.length && !contactRepairEmails.size) throw new Error('No missing orders or contact fields were identified for the requested backfill period.');
if (incompleteOrdersToApply.length) throw new Error('Refusing to apply because one or more missing orders has incomplete contact or order data.');

const rows = dataRows.map((row) => [...row]);
const byEmail = new Map(rows.map((row, index) => [row[0].trim().toLowerCase(), index]));
for (const order of orders) {
	const rowIndex = byEmail.get(order.email);
	if (rowIndex == null || !contactRepairEmails.has(order.email)) continue;
	const row = rows[rowIndex];
	if (!row[1]) row[1] = order.firstName;
	if (!row[2]) row[2] = order.lastName;
	if (!row[3]) row[3] = order.address;
	if (!row[4]) row[4] = order.city;
	if (!row[5]) row[5] = order.province;
	if (!row[6]) row[6] = order.zipCode;
	if (!row[7]) row[7] = order.country;
}
for (const order of ordersToApply) {
	let rowIndex = byEmail.get(order.email);
	if (rowIndex == null) {
		rowIndex = rows.length;
		byEmail.set(order.email, rowIndex);
		rows.push([order.email, order.firstName, order.lastName, order.address, order.city, order.province, order.zipCode, order.country, '0', '0.00', '', '', '', '']);
	}
	const row = rows[rowIndex];
	const products = new Set(row[11].split(', ').filter(Boolean));
	for (const product of order.products) products.add(product);
	row[0] = order.email;
	row[1] = order.firstName || row[1];
	row[2] = order.lastName || row[2];
	row[3] = order.address || row[3];
	row[4] = order.city || row[4];
	row[5] = order.province || row[5];
	row[6] = order.zipCode || row[6];
	row[7] = order.country || row[7];
	row[8] = String(number(row[8]) + 1);
	row[9] = (number(row[9]) + order.total).toFixed(2);
	row[10] = displayDate(order.orderDate);
	row[11] = [...products].join(', ');
	if (order.discount) row[13] = [row[13], order.discount].filter(Boolean).join('; ');
}

const values = [CLIENT_HEADERS, ...rows];
await sheets.spreadsheets.values.update({
	spreadsheetId: SHEET_ID,
	range: `Clients!A1:N${values.length}`,
	valueInputOption: 'RAW',
	requestBody: { values },
});

const verification = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `Clients!A1:N${values.length}` });
const saved = (verification.data.values ?? []).map((row) => Array.from({ length: 14 }, (_unused, index) => String(row[index] ?? '')));
saved[0] = CLIENT_HEADERS;
if (JSON.stringify(saved) !== JSON.stringify(values)) throw new Error('Post-write verification did not match the intended Clients sheet values.');
console.log(
	JSON.stringify(
		{
			applied: true,
			ordersBackfilled: ordersToApply.length,
			clientContactsRepaired: contactRepairEmails.size,
			finalClientRows: rows.length,
			latestBackfilledOrderDate: ordersToApply.length ? displayDate(ordersToApply.at(-1).orderDate) : null,
		},
		null,
		2,
	),
);
