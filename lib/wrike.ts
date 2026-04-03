import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'node:fs';
import path from 'node:path';
import FormData from 'form-data';
import axios from 'axios';
import sharp from 'sharp';

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';

type WrikeConfig = {
	apiToken: string;
	ordersFolderId: string;
	clientsFolderId: string;
};

function getWrikeConfig(): WrikeConfig | null {
	const apiToken = process.env.WRIKE_API_TOKEN;
	const ordersFolderId = process.env.WRIKE_ORDERS_FOLDER_ID;
	const clientsFolderId = process.env.WRIKE_CLIENTS_FOLDER_ID;

	if (!apiToken || !ordersFolderId || !clientsFolderId) {
		return null;
	}

	return { apiToken, ordersFolderId, clientsFolderId };
}

type CustomFieldInput = { id: string; value: string };

async function createTask(folderId: string, title: string, description: string, apiToken: string, options?: { customFields?: CustomFieldInput[]; superTaskId?: string }) {
	const body: Record<string, unknown> = { title, description, status: 'Active' };
	const customFields = options?.customFields;
	if (Array.isArray(customFields) && customFields.length > 0) {
		body.customFields = customFields;
	}
	const superTaskId = options?.superTaskId;
	if (superTaskId) {
		body.superTasks = [superTaskId];
	}
	const url = superTaskId ? `${WRIKE_API_BASE}/tasks` : `${WRIKE_API_BASE}/folders/${folderId}/tasks`;
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const error = await response.text();
		console.error('[Wrike] API error:', response.status, error);
		return null;
	}

	const data = await response.json();
	return data.data?.[0] ?? null;
}

async function createOrderSubtasks(parentTaskId: string, folderId: string, apiToken: string) {
	const subitems = ['Pick product', 'Package products', 'Ship out', 'Send customer ship notification with tracking'];
	const created: Array<unknown> = [];
	for (const title of subitems) {
		try {
			const subtask = await createTask(folderId, title, '', apiToken, { superTaskId: parentTaskId });
			if (subtask) {
				created.push(subtask);
			} else {
				console.warn('[Wrike] Failed to create order subtask:', { parentTaskId, title });
			}
		} catch (error) {
			console.error('[Wrike] Error creating order subtask:', { parentTaskId, title, error });
		}
	}
	console.log('[Wrike] Order subtasks created:', { parentTaskId, createdCount: created.length, expectedCount: subitems.length });
	return created;
}

async function getTasksInFolder(folderId: string, apiToken: string): Promise<Array<{ id: string; title: string; description?: string; customFields?: Array<{ id: string; value: string }> }>> {
	const response = await fetch(`${WRIKE_API_BASE}/folders/${folderId}/tasks`, {
		headers: { Authorization: `Bearer ${apiToken}` },
	});
	if (!response.ok) return [];
	const data = await response.json();
	return data.data ?? [];
}

async function getTask(taskId: string, apiToken: string): Promise<{ id: string; title: string; description?: string } | null> {
	const response = await fetch(`${WRIKE_API_BASE}/tasks/${taskId}`, {
		headers: { Authorization: `Bearer ${apiToken}` },
	});
	if (!response.ok) return null;
	const data = await response.json();
	const tasks = data.data;
	return Array.isArray(tasks) && tasks.length > 0 ? tasks[0] : null;
}

async function updateTask(taskId: string, updates: { title?: string; description?: string; customFields?: CustomFieldInput[] }, apiToken: string): Promise<unknown> {
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
		console.error('[Wrike] API update error:', response.status, error);
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
		cost?: number;
	}>;
	totalCost?: number;
};

export async function createOrderTask(order: OrderData) {
	const config = getWrikeConfig();
	if (!config) {
		const missing = [
			!process.env.WRIKE_API_TOKEN && 'WRIKE_API_TOKEN',
			!process.env.WRIKE_ORDERS_FOLDER_ID && 'WRIKE_ORDERS_FOLDER_ID',
			!process.env.WRIKE_CLIENTS_FOLDER_ID && 'WRIKE_CLIENTS_FOLDER_ID',
		].filter(Boolean);
		console.warn('[Wrike] Skipping order task: not configured. Missing:', missing.join(', ') || 'unknown');
		return null;
	}

	const title = `Order #${order.orderNumber} - ${order.customer.firstName} ${order.customer.lastName}`;

	const shippingAddr = order.shipToDifferentAddress && order.shippingAddress ? order.shippingAddress : order.customer;

	const itemsList = order.cartItems.map((item) => `<li>${item.name} × ${item.quantity} - $${(item.price * item.quantity).toFixed(2)}</li>`).join('');

	const stockList = order.stockLevels?.length
		? order.stockLevels
				.map((item) => {
					const isLow = item.stock <= 5;
					const costInfo = item.cost ? ` (Cost: $${item.cost.toFixed(2)})` : '';
					return `<li>${item.name}: <b style="${isLow ? 'color:red' : ''}">${item.stock} units</b>${isLow ? ' ⚠️ LOW' : ''}${costInfo}</li>`;
				})
				.join('')
		: '';

	const totalCost = order.totalCost ?? 0;
	const grossProfit = order.subtotal - totalCost;
	const profitMargin = order.subtotal > 0 ? (grossProfit / order.subtotal) * 100 : 0;

	const financialSection =
		totalCost > 0
			? `
<hr>
<h4>Financial Summary</h4>
<p>
<b>Revenue:</b> $${order.subtotal.toFixed(2)}<br>
<b>COGS (Cost of Goods Sold):</b> $${totalCost.toFixed(2)}<br>
<b>Gross Profit:</b> <span style="color:${grossProfit >= 0 ? 'green' : 'red'}">$${grossProfit.toFixed(2)}</span><br>
<b>Profit Margin:</b> ${profitMargin.toFixed(1)}%
</p>
	`.trim()
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
${formatAddressLine(order.customer.address, order.customer.addressLine2).join('<br>')}<br>
${order.customer.city}, ${order.customer.province} ${order.customer.zipCode}<br>
${order.customer.country}
</p>
<h4>Shipping Address</h4>
<p>
${formatAddressLine(shippingAddr.address, shippingAddr.addressLine2).join('<br>')}<br>
${shippingAddr.city}, ${shippingAddr.province} ${shippingAddr.zipCode}
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
${financialSection}
${stockList ? `<hr><h4>Stock Remaining</h4><ul>${stockList}</ul>` : ''}
${order.customer.orderNotes ? `<hr><h4>Order Notes</h4><p>${order.customer.orderNotes}</p>` : ''}
<hr>
<p><b>Status: NEW ORDER - AWAITING PAYMENT</b></p>
	`.trim();

	try {
		const task = await createTask(config.ordersFolderId, title, description, config.apiToken);
		if (task) {
			console.log('Wrike order task created:', task.id);
			await createOrderSubtasks(task.id, config.ordersFolderId, config.apiToken);
			// Attach label PDF to the "Create shipping labels" subtask immediately
			await attachLabelPdfToOrder(task.id, description, config.apiToken);
		}
		return task;
	} catch (error) {
		console.error('Failed to create Wrike order task:', error);
		return null;
	}
}

type ClientData = {
	email: string;
	firstName: string;
	lastName: string;
	address: string;
	city: string;
	province: string;
	zipCode: string;
	country: string;
	orderTotal: number;
	lastOrderDate: string;
	productsPurchased: string[];
};

function buildOrderBlock(client: ClientData): string {
	const productsList = client.productsPurchased.length ? `<ul>${client.productsPurchased.map((p) => `<li>${p}</li>`).join('')}</ul>` : '<p>None</p>';
	return `
<hr>
<h4>Order – ${client.lastOrderDate}</h4>
<p><b>Total: $${client.orderTotal.toFixed(2)}</b></p>
<h5>Products</h5>
${productsList}
	`.trim();
}

function buildFullClientDescription(client: ClientData): string {
	const productsList = client.productsPurchased.length ? `<ul>${client.productsPurchased.map((p) => `<li>${p}</li>`).join('')}</ul>` : '<p>None</p>';
	return `
<h3>Client Record</h3>
<h4>Contact</h4>
<p>
<b>Name:</b> ${client.firstName} ${client.lastName}<br>
<b>Email:</b> ${client.email}<br>
</p>
<h4>Address</h4>
<p>
${client.address}<br>
${client.city}, ${client.province} ${client.zipCode}<br>
${client.country}
</p>
<hr>
<h4>Order – ${client.lastOrderDate}</h4>
<p><b>Total: $${client.orderTotal.toFixed(2)}</b></p>
<h5>Products</h5>
${productsList}
	`.trim();
}

export async function createClientTask(client: ClientData) {
	const config = getWrikeConfig();
	if (!config) {
		const missing = [
			!process.env.WRIKE_API_TOKEN && 'WRIKE_API_TOKEN',
			!process.env.WRIKE_ORDERS_FOLDER_ID && 'WRIKE_ORDERS_FOLDER_ID',
			!process.env.WRIKE_CLIENTS_FOLDER_ID && 'WRIKE_CLIENTS_FOLDER_ID',
		].filter(Boolean);
		console.warn('[Wrike] Skipping client task: not configured. Missing:', missing.join(', ') || 'unknown');
		return null;
	}

	const clientEmailFieldId = process.env.WRIKE_CLIENT_EMAIL_FIELD_ID;
	const title = `${client.firstName} ${client.lastName}`;
	const orderTotalFieldId = process.env.WRIKE_ORDER_TOTAL_FIELD_ID;
	const customFieldsOnCreate: CustomFieldInput[] = [];
	if (clientEmailFieldId) {
		customFieldsOnCreate.push({ id: clientEmailFieldId, value: client.email });
	}
	if (orderTotalFieldId) {
		customFieldsOnCreate.push({ id: orderTotalFieldId, value: `$${client.orderTotal.toFixed(2)}` });
	}

	try {
		// Stack by client: find existing task by email if custom field is configured
		if (clientEmailFieldId) {
			const tasks = await getTasksInFolder(config.clientsFolderId, config.apiToken);
			const normalizedEmail = client.email.trim().toLowerCase();
			const existing = tasks.find((t) => {
				const cf = t.customFields ?? [];
				const emailVal = cf
					.find((f) => f.id === clientEmailFieldId)
					?.value?.trim()
					.toLowerCase();
				return emailVal === normalizedEmail;
			});

			if (existing) {
				const current = await getTask(existing.id, config.apiToken);
				const prevDesc = (current?.description ?? '').trim();
				const newBlock = buildOrderBlock(client);
				const updatedDesc = prevDesc ? `${prevDesc}\n${newBlock}` : buildFullClientDescription(client);
				const updatePayload: { description: string; customFields?: CustomFieldInput[] } = { description: updatedDesc };
				const updateCustomFields: CustomFieldInput[] = [];
				updateCustomFields.push({ id: clientEmailFieldId, value: client.email });
				if (orderTotalFieldId) {
					updateCustomFields.push({ id: orderTotalFieldId, value: `$${client.orderTotal.toFixed(2)}` });
				}
				updatePayload.customFields = updateCustomFields;
				const updated = await updateTask(existing.id, updatePayload, config.apiToken);
				if (updated) {
					console.log('[Wrike] Client task updated (order appended):', existing.id);
				}
				return updated ?? null;
			}
		}

		// New client: create task
		const description = buildFullClientDescription(client);
		const task = await createTask(config.clientsFolderId, title, description, config.apiToken, { customFields: customFieldsOnCreate.length > 0 ? customFieldsOnCreate : undefined });
		if (task) {
			console.log('Wrike client task created:', task.id);
		}
		return task;
	} catch (error) {
		console.error('Failed to create Wrike client task:', error);
		return null;
	}
}

// === Label PDF helpers ===

async function ensureLogoPng(): Promise<string | null> {
	const svgPath = path.resolve(process.cwd(), 'public', 'logo.svg');
	const pngPath = path.resolve(process.cwd(), 'public', 'logo.png');
	if (fs.existsSync(pngPath)) return pngPath;
	if (!fs.existsSync(svgPath)) return null;
	try {
		await sharp(svgPath)
			.resize(72, 72) // 1x1 inch at 72 DPI
			.png()
			.toFile(pngPath);
		console.log('[Wrike] Generated logo.png from logo.svg');
		return pngPath;
	} catch (e) {
		console.warn('[Wrike] Failed to convert logo.svg to PNG:', e);
		return null;
	}
}

function stripHtml(input: string): string {
	if (!input) return '';
	return String(input)
		.replace(/<br\s*\/?\s*>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<\/h\d>/gi, '\n')
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\r\n/g, '\n');
}

function normalizeLines(text: string): string[] {
	const lines = text
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const result: string[] = [];
	for (const line of lines) {
		// Canadian/US postal code patterns
		const match = line.match(/(.+?)\s*([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)\s*$/);
		if (match) {
			result.push(match[1].trim());
			result.push(match[2].trim());
		} else {
			result.push(line);
		}
	}
	return result;
}

function formatAddressLine(address: string, addressLine2: string): string[] {
	const unitPattern = /^(unit|apt|apartment|suite|ste|#\s*)\s*([^\s]+(?:\s+[^\s]+)*)/i;
	const addressLine = addressLine2 ? `${addressLine2}-${address}` : address;
	const match = addressLine.match(unitPattern);
	if (match) {
		const unit = match[1];
		const number = match[2];
		const street = address.slice(match[0].length).trim();
		return [`${unit}-${number} ${street}`];
	}
	// If no unit pattern but there's addressLine2, prepend with dash
	if (addressLine2) {
		return [`${addressLine2}-${address}`];
	}
	return [addressLine];
}

function parseLabelFromOrderDescription(html: string): { name: string; lines: string[] } | null {
	const nameMatch = String(html).match(/<b>\s*Name:\s*<\/b>\s*([^<]+?)\s*<br\s*\/?\s*>/i);
	const name = nameMatch ? stripHtml(nameMatch[1]).trim() : '';

	// Prefer Shipping Address if present; otherwise fall back to Billing Address
	const shippingMatch = String(html).match(/<h4>\s*Shipping Address\s*<\/h4>\s*<p>([\s\S]*?)<\/p>/i);
	const billingMatch = String(html).match(/<h4>\s*Billing Address\s*<\/h4>\s*<p>([\s\S]*?)<\/p>/i);
	const match = shippingMatch || billingMatch;
	if (!match) return null;
	const text = stripHtml(match[1]);

	// Extract address and addressLine2 if present
	const lines = normalizeLines(text);
	if (lines.length === 0) return null;

	const unitPattern = /^(unit|apt|apartment|suite|ste|#\s*)\s*([^\s]+(?:\s+[^\s]+)*)/i;
	const addressLines: string[] = [];
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];

		// Check if this is already a combined address with dash (e.g., "204-2092 2nd Ave W")
		const combinedPattern = /^([^\s]+(?:\s+[^\s]+)*)-(.+)$/;
		const combinedMatch = line.match(combinedPattern);
		if (combinedMatch) {
			// Already properly formatted, just use as-is
			addressLines.push(line);
			i += 1;
			continue;
		}

		const unitMatch = line.match(unitPattern);
		if (unitMatch && i + 1 < lines.length) {
			// This line is a unit and the next line is the street address
			const number = unitMatch[2];
			const street = lines[i + 1];
			addressLines.push(`${number}-${street}`);
			i += 2; // skip both lines
		} else if (unitMatch && lines.length === 1) {
			// Unit and street are on the same line
			const number = unitMatch[2];
			const street = line.slice(unitMatch[0].length).trim();
			addressLines.push(`${number}-${street}`);
			i += 1;
		} else {
			// Regular address line
			addressLines.push(line);
			i += 1;
		}
	}

	return { name: name || 'Recipient', lines: addressLines };
}

async function generateSingleLabelPdf(label: { name: string; lines: string[] }, outputPath: string): Promise<void> {
	const pdfDoc = await PDFDocument.create();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

	// Ensure logo PNG exists and embed it
	const logoPngPath = await ensureLogoPng();
	let logoImage = null;
	let logoWidth = 0;
	let logoHeight = 0;
	if (logoPngPath) {
		const logoBytes = fs.readFileSync(logoPngPath);
		logoImage = await pdfDoc.embedPng(logoBytes);
		// Preserve aspect ratio: cap height at 36pt
		const { width, height } = await pdfDoc.embedPng(logoBytes);
		const maxLogoHeight = 30;
		logoHeight = maxLogoHeight;
		logoWidth = (width / height) * maxLogoHeight;
	}

	// 4x6 inches
	const pageWidth = 4 * 72;
	const pageHeight = 6 * 72;
	const margin = 18;
	const nameSize = 14;
	const logoMargin = 12;
	const textLeft = logoImage ? margin + logoWidth + logoMargin : margin;

	// Limit label content height to 2 inches
	const maxY = pageHeight - margin - 2 * 72;

	const page = pdfDoc.addPage([pageWidth, pageHeight]);
	let y = pageHeight - margin;
	const maxWidth = pageWidth - margin * 2;

	// Draw logo at top-left if available
	if (logoImage) {
		page.drawImage(logoImage, {
			x: margin,
			y: pageHeight - margin - logoHeight,
			width: logoWidth,
			height: logoHeight,
		});
	}

	const lineSize = 12;
	const leading = 14;

	const wrapText = (font: any, text: string, size: number, maxWidth: number): string[] => {
		const words = String(text).split(/\s+/).filter(Boolean);
		const lines: string[] = [];
		let current = '';
		for (const w of words) {
			const candidate = current ? `${current} ${w}` : w;
			const width = font.widthOfTextAtSize(candidate, size);
			if (width <= maxWidth) {
				current = candidate;
				continue;
			}
			if (current) lines.push(current);
			current = w;
		}
		if (current) lines.push(current);
		return lines;
	};

	const nameLines = wrapText(fontBold, `To: ${label.name}`, nameSize, maxWidth);
	for (const line of nameLines) {
		y -= nameSize;
		page.drawText(line, { x: textLeft, y, size: nameSize, font: fontBold, color: rgb(0, 0, 0) });
	}

	// No extra space between name and address
	for (const addrLine of label.lines) {
		const wrapped = wrapText(font, addrLine, lineSize, maxWidth);
		for (const wLine of wrapped) {
			y -= leading;
			if (y < maxY) break; // Stop at 2-inch limit
			page.drawText(wLine, { x: textLeft, y, size: lineSize, font, color: rgb(0, 0, 0) });
		}
		if (y < maxY) break; // Stop at 2-inch limit
	}

	const bytes = await pdfDoc.save();
	fs.writeFileSync(outputPath, bytes);
}

async function uploadAttachmentToTask(taskId: string, filePath: string, apiToken: string): Promise<any> {
	const form = new FormData();
	form.append('file', fs.createReadStream(filePath));

	const res = await axios.post(`${WRIKE_API_BASE}/tasks/${taskId}/attachments`, form, {
		headers: {
			Authorization: `Bearer ${apiToken}`,
			...form.getHeaders(),
		},
		maxBodyLength: Infinity,
		validateStatus: () => true,
	});

	if (res.status < 200 || res.status >= 300) {
		throw new Error(`Wrike attachment upload failed ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`);
	}
	return res.data?.data?.[0] || null;
}

async function findSubtaskByTitle(parentTaskId: string, title: string, apiToken: string): Promise<any> {
	const res = await axios.get(`${WRIKE_API_BASE}/folders/${process.env.WRIKE_ORDERS_FOLDER_ID}/tasks`, {
		headers: { Authorization: `Bearer ${apiToken}` },
		params: { fields: JSON.stringify(['superTaskIds', 'createdDate']) },
		validateStatus: () => true,
	});
	if (res.status < 200 || res.status >= 300) return null;
	const all = Array.isArray(res.data?.data) ? res.data.data : [];
	const subtasks = all
		.filter((t: any) => Array.isArray(t.superTaskIds) && t.superTaskIds.includes(parentTaskId))
		.sort((a: any, b: any) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
	return subtasks.find((st: any) => st.title?.trim() === title.trim()) || null;
}

async function createSubtask(parentTaskId: string, title: string, description: string, apiToken: string): Promise<any> {
	const body = { title, description, status: 'Active', superTasks: [parentTaskId] };
	const res = await axios.post(`${WRIKE_API_BASE}/tasks`, body, {
		headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
		validateStatus: () => true,
	});
	if (res.status < 200 || res.status >= 300) return null;
	return res.data?.data?.[0] || null;
}

export async function attachLabelPdfToOrder(orderTaskId: string, orderDescription: string, apiToken: string): Promise<void> {
	console.log('[Wrike] Order description preview (first 400 chars):', orderDescription.slice(0, 400));
	const parsed = parseLabelFromOrderDescription(orderDescription);
	if (!parsed || !parsed.name || !parsed.lines.length) {
		console.warn('[Wrike] Could not parse label from order description; skipping PDF attachment.');
		return;
	}

	const tempPdf = path.resolve(process.cwd(), `label-${orderTaskId}.pdf`);
	await generateSingleLabelPdf(parsed, tempPdf);

	let subtask = await findSubtaskByTitle(orderTaskId, 'Create shipping labels', apiToken);
	if (!subtask) {
		subtask = await createSubtask(orderTaskId, 'Create shipping labels', '', apiToken);
		if (!subtask) {
			console.warn('[Wrike] Failed to create "Create shipping labels" subtask; skipping PDF attachment.');
			fs.unlinkSync(tempPdf);
			return;
		}
	}

	const uploaded = await uploadAttachmentToTask(subtask.id, tempPdf, apiToken);
	if (uploaded) {
		console.log('[Wrike] Label PDF attached to subtask:', { subtaskId: subtask.id, attachmentId: uploaded.id });
	} else {
		console.warn('[Wrike] Failed to upload label PDF to subtask.');
	}

	try {
		fs.unlinkSync(tempPdf);
	} catch {
		// ignore cleanup failure
	}
}
