import { sendShippingConfirmation, ShippingConfirmationData } from './shippingEmail';
import { getOrderByOrderNumberFromDb, upsertOrderInDb } from './ordersDb';

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';

type WrikeTask = {
	id: string;
	title: string;
	description: string;
	status: string;
	customFields?: Array<{
		id: string;
		value: string;
	}>;
};

type WrikeWebhookPayload = {
	oldStatus?: string;
	newStatus: string;
	taskId: string;
	folderId: string;
};

export function normalizeTrackingNumber(value: string | null | undefined): string {
	return String(value ?? '')
		.trim()
		.replace(/\s+/g, '')
		.toUpperCase();
}

export function isValidTrackingValue(value: string | null | undefined): value is string {
	if (!value) return false;
	const normalized = normalizeTrackingNumber(value);
	if (!normalized) return false;
	if (normalized === 'MANUAL' || normalized === 'N/A' || normalized === 'LOCAL' || normalized === 'NONE') return false;
	// Canada Post tracking: PG + 9 digits + CA (e.g., PG754389530CA)
	if (!/^PG\d{9}CA$/i.test(normalized)) return false;
	return true;
}

export async function hasTrackingEmailInProgress(orderNumber: string): Promise<boolean> {
	const order = await getOrderByOrderNumberFromDb(orderNumber);
	if (!order) return false;
	const startedAt = order.trackingEmailSendStartedAt ? String(order.trackingEmailSendStartedAt) : '';
	if (!startedAt) return false;
	const started = new Date(startedAt);
	if (Number.isNaN(started.getTime())) return false;
	return Date.now() - started.getTime() < 10 * 60 * 1000;
}

export async function markTrackingEmailSendStarted(params: { orderNumber: string; taskId: string; trackingNumber: string; via: 'webhook' | 'manual' | 'cron'; route: string }): Promise<void> {
	const existing = await getOrderByOrderNumberFromDb(params.orderNumber);
	const now = new Date().toISOString();
	const next = existing
		? { ...existing }
		: {
				id: `order_${params.orderNumber}`,
				orderNumber: params.orderNumber,
				createdAt: now,
				paymentStatus: 'unknown',
			};
	await upsertOrderInDb({
		...next,
		trackingEmailSendStartedAt: now,
		trackingEmailSendStartedTrackingNumber: params.trackingNumber,
		trackingEmailSendStartedWrikeTaskId: params.taskId,
		trackingEmailSendStartedVia: params.via,
		trackingEmailSendStartedRoute: params.route,
	});
}

export async function markTrackingEmailSendFailed(params: { orderNumber: string; error: string }): Promise<void> {
	const existing = await getOrderByOrderNumberFromDb(params.orderNumber);
	if (!existing) return;
	await upsertOrderInDb({
		...existing,
		trackingEmailSendLastError: params.error,
		trackingEmailSendFailedAt: new Date().toISOString(),
		trackingEmailSendStartedAt: null,
	} as Record<string, unknown>);
}

export async function sendTrackingEmailManually(params: {
	orderNumber?: string;
	taskId?: string;
	route: string;
	customerEmail?: string;
	customerName?: string;
	trackingNumber?: string;
	shippingMethod?: 'regular' | 'express';
}): Promise<{ ok: boolean; message?: string; error?: string; orderNumber?: string; taskId?: string; trackingNumber?: string }> {
	try {
		const apiToken = process.env.WRIKE_API_TOKEN;
		const ordersFolderId = process.env.WRIKE_ORDERS_FOLDER_ID;
		const trackingNumberFieldId = process.env.WRIKE_TRACKING_NUMBER_FIELD_ID;

		let task: WrikeTask | null = null;
		let orderNumberFromContext: string | undefined;

		const overrideOrderNumber = params.orderNumber ? String(params.orderNumber).trim() : '';
		const overrideCustomerEmail = params.customerEmail ? String(params.customerEmail).trim() : '';
		const overrideCustomerName = params.customerName ? String(params.customerName).trim() : '';
		const overrideTrackingNumber = params.trackingNumber ? String(params.trackingNumber).trim() : '';

		const hasOverrides = Boolean(overrideOrderNumber && overrideCustomerEmail && overrideCustomerName && overrideTrackingNumber);

		if (hasOverrides) {
			orderNumberFromContext = overrideOrderNumber;
		} else {
			if (!apiToken || !ordersFolderId || !trackingNumberFieldId) {
				return { ok: false, error: 'Wrike not configured' };
			}
		}

		if (params.taskId) {
			if (!apiToken || !ordersFolderId || !trackingNumberFieldId) {
				return { ok: false, error: 'Wrike not configured' };
			}
			task = await getWrikeTask(params.taskId);
		} else if (params.orderNumber) {
			if (!apiToken || !ordersFolderId || !trackingNumberFieldId) {
				return { ok: false, error: 'Wrike not configured' };
			}
			const response = await fetch(`${WRIKE_API_BASE}/folders/${ordersFolderId}/tasks?fields=['description','customFields']`, {
				headers: { Authorization: `Bearer ${apiToken}` },
			});
			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Failed to fetch tasks: ${response.status} ${error}`);
			}
			const data = await response.json();
			const tasks: WrikeTask[] = data.data || [];
			task = tasks.find((t) => t.title?.includes(`Order #${params.orderNumber}`)) ?? null;
		}

		const titleMatch = task ? task.title.match(/Order #(\d+)/) : null;
		const orderNumber = orderNumberFromContext ?? titleMatch?.[1] ?? params.orderNumber;
		if (!orderNumber) {
			return { ok: false, error: 'Not an order task (no order number)' };
		}

		if (await hasTrackingEmailAlreadyBeenSent(orderNumber)) {
			console.log(`[wrikeShipping] tracking email already sent`, { orderNumber, taskId: task?.id, route: params.route });
			return { ok: true, message: 'tracking email already sent', orderNumber, taskId: task?.id };
		}

		if (task?.description?.includes('Shipping Confirmation Sent')) {
			console.log(`[wrikeShipping] tracking email already sent (task description marker)`, { orderNumber, taskId: task.id, route: params.route });
			return { ok: true, message: 'tracking email already sent', orderNumber, taskId: task.id };
		}

		let trackingNumber: string | undefined;
		if (hasOverrides) {
			trackingNumber = normalizeTrackingNumber(overrideTrackingNumber);
		} else {
			const trackingNumberField = task?.customFields?.find((f) => f.id === trackingNumberFieldId);
			trackingNumber = normalizeTrackingNumber(trackingNumberField?.value);
		}

		if (!isValidTrackingValue(trackingNumber)) {
			console.log(`[wrikeShipping] skipped: invalid tracking number`, { orderNumber, taskId: task?.id, trackingNumber, route: params.route });
			return { ok: true, message: 'skipped: invalid tracking number', orderNumber, taskId: task?.id, trackingNumber };
		}

		console.log(`[wrikeShipping] manual tracking email trigger`, { orderNumber, taskId: task?.id, route: params.route });
		let orderData: ShippingConfirmationData | null = null;
		if (hasOverrides) {
			orderData = {
				orderNumber,
				customerEmail: overrideCustomerEmail,
				customerName: overrideCustomerName,
				trackingNumber,
				shippingMethod: params.shippingMethod ?? 'regular',
			};
		} else if (task) {
			orderData = extractOrderData(task, trackingNumber);
		}
		if (!orderData) return { ok: false, error: 'Failed to extract order data from task' };

		if (await hasTrackingEmailInProgress(orderNumber)) {
			console.log(`[wrikeShipping] skipped: already sending`, { orderNumber, taskId: task?.id, route: params.route });
			return { ok: true, message: 'skipped: already sending', orderNumber, taskId: task?.id };
		}

		await markTrackingEmailSendStarted({
			orderNumber: orderData.orderNumber,
			taskId: task?.id ?? params.taskId ?? 'manual',
			trackingNumber: orderData.trackingNumber,
			via: 'manual',
			route: params.route,
		});

		const emailResult = await sendShippingConfirmation(orderData);
		if (!emailResult.success) {
			await markTrackingEmailSendFailed({ orderNumber: orderData.orderNumber, error: String(emailResult.error ?? 'unknown') });
			return { ok: false, error: `Failed to send shipping confirmation: ${emailResult.error}` };
		}

		if (task?.id) {
			await updateTaskWithShippingConfirmation(task.id, orderData.trackingNumber);
		}
		await markTrackingEmailSentManual({ orderNumber: orderData.orderNumber, taskId: task?.id ?? params.taskId ?? 'manual', trackingNumber: orderData.trackingNumber, route: params.route });
		return {
			ok: true,
			message: `Shipping confirmation sent for order #${orderData.orderNumber}`,
			orderNumber: orderData.orderNumber,
			taskId: task?.id ?? params.taskId,
			trackingNumber: orderData.trackingNumber,
		};
	} catch (error) {
		console.error('[wrikeShipping] Error sending manual tracking email:', error);
		return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

export async function hasTrackingEmailAlreadyBeenSent(orderNumber: string): Promise<boolean> {
	const order = await getOrderByOrderNumberFromDb(orderNumber);
	if (!order) return false;
	return Boolean(order.trackingEmailSentAt);
}

export async function markTrackingEmailSent(params: { orderNumber: string; taskId: string; trackingNumber: string; customerEmail?: string; via?: 'webhook' | 'cron'; route?: string }): Promise<void> {
	const existing = await getOrderByOrderNumberFromDb(params.orderNumber);
	const now = new Date().toISOString();
	const next = existing
		? { ...existing }
		: {
				id: `order_${params.orderNumber}`,
				orderNumber: params.orderNumber,
				createdAt: now,
				paymentStatus: 'unknown',
			};
	await upsertOrderInDb({
		...next,
		trackingEmailSendStartedAt: null,
		trackingEmailSentAt: now,
		trackingEmailSentTrackingNumber: params.trackingNumber,
		trackingEmailSentWrikeTaskId: params.taskId,
		trackingEmailSentCustomerEmail: params.customerEmail,
		trackingEmailSentVia: params.via,
		trackingEmailSentRoute: params.route,
	});
}

async function markTrackingEmailSentManual(params: { orderNumber: string; taskId: string; trackingNumber: string; route: string }): Promise<void> {
	const existing = await getOrderByOrderNumberFromDb(params.orderNumber);
	const now = new Date().toISOString();
	const next = existing
		? { ...existing }
		: {
				id: `order_${params.orderNumber}`,
				orderNumber: params.orderNumber,
				createdAt: now,
				paymentStatus: 'unknown',
			};
	await upsertOrderInDb({
		...next,
		trackingEmailSendStartedAt: null,
		trackingEmailSentAt: now,
		trackingEmailSentTrackingNumber: params.trackingNumber,
		trackingEmailSentWrikeTaskId: params.taskId,
		trackingEmailSentVia: 'manual',
		trackingEmailSentRoute: params.route,
	});
}

async function getWrikeTask(taskId: string): Promise<WrikeTask | null> {
	const apiToken = process.env.WRIKE_API_TOKEN;
	if (!apiToken) {
		console.error('[wrikeShipping] WRIKE_API_TOKEN not configured');
		return null;
	}

	try {
		const response = await fetch(`${WRIKE_API_BASE}/tasks/${taskId}`, {
			headers: { Authorization: `Bearer ${apiToken}` },
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to fetch task: ${response.status} ${error}`);
		}

		const data = await response.json();
		return data.data?.[0] ?? null;
	} catch (error) {
		console.error('[wrikeShipping] Error fetching Wrike task:', error);
		return null;
	}
}

function extractOrderData(task: WrikeTask, trackingNumber: string): ShippingConfirmationData | null {
	// Extract order number from title (format: "Order #12345 - John Doe")
	const titleMatch = task.title.match(/Order #(\d+)/);
	if (!titleMatch) {
		console.error('[wrikeShipping] Could not extract order number from task title:', task.title);
		return null;
	}

	const orderNumber = titleMatch[1];

	if (!isValidTrackingValue(trackingNumber)) {
		console.log('[wrikeShipping] Invalid tracking number for order #', orderNumber);
		return null;
	}

	// Extract customer details from task description
	const description = task.description;
	const emailMatch = description.match(/<b>Email:<\/b> ([^<]+)/);
	const nameMatch = description.match(/<b>Name:<\/b> ([^<]+)/);
	const shippingMethodMatch = description.match(/Shipping \(([^)]+)\)/);

	if (!emailMatch || !nameMatch) {
		console.error('[wrikeShipping] Could not extract customer details from task description');
		return null;
	}

	// Decode HTML entities (e.g., &#64; -> @)
	const decodeHtmlEntities = (text: string): string => {
		return text.replace(/&#(\d+);/g, (_match: string, dec: string) => String.fromCharCode(parseInt(dec, 10)));
	};

	const customerEmail = decodeHtmlEntities(emailMatch[1].trim());
	const customerName = nameMatch[1].trim();
	const shippingMethod = shippingMethodMatch?.[1]?.includes('express') ? 'express' : 'regular';

	// Extract shipping address
	const shippingAddressMatch = description.match(/<h4>Shipping Address<\/h4>\s*<p>([\s\S]*?)<\/p>/);
	let shippingAddress;

	if (shippingAddressMatch) {
		const addressText = shippingAddressMatch[1]
			.replace(/<br>/g, '\n')
			.replace(/<[^>]*>/g, '')
			.trim();

		const addressLines = addressText.split('\n').filter((line) => line.trim());
		if (addressLines.length >= 3) {
			shippingAddress = {
				address: addressLines[0],
				addressLine2: addressLines[1] || '',
				city: addressLines[addressLines.length - 2]?.split(',')[0] || '',
				province: addressLines[addressLines.length - 2]?.split(',')[1]?.trim() || '',
				zipCode: addressLines[addressLines.length - 1] || '',
			};
		}
	}

	return {
		orderNumber,
		customerEmail,
		customerName,
		trackingNumber,
		shippingMethod,
		shippingAddress,
	};
}

export async function handleWrikeTaskCompletion(payload: WrikeWebhookPayload): Promise<{ success: boolean; message?: string; error?: string }> {
	const { taskId, newStatus } = payload;

	console.log('[wrikeShipping] webhook received', { taskId, newStatus });

	// Only proceed if task is marked as completed
	if (newStatus.toLowerCase() !== 'completed') {
		return { success: true, message: 'Task not completed, skipping shipping confirmation' };
	}

	console.log('[wrikeShipping] task completed', { taskId });

	// Get full task details
	const task = await getWrikeTask(taskId);
	if (!task) {
		// Wrike can deliver duplicate webhook events and transient network failures can occur.
		// We return success=true so the webhook endpoint still returns 200 and doesn't trigger retries.
		return { success: true, message: 'skipped: failed to fetch task details (transient wrike fetch error)' };
	}

	// Verify this is an order task (should have "Order #" in title)
	if (!task.title.includes('Order #')) {
		return { success: true, message: 'Not an order task, skipping shipping confirmation' };
	}

	// Extract order number early so we can apply durable idempotency via the orders DB.
	const titleMatch = task.title.match(/Order #(\d+)/);
	const orderNumber = titleMatch?.[1];
	if (!orderNumber) {
		return { success: true, message: 'Not an order task (no order number), skipping shipping confirmation' };
	}

	// Durable idempotency: if order record shows the tracking email was already sent, never send again.
	if (await hasTrackingEmailAlreadyBeenSent(orderNumber)) {
		console.log(`[wrikeShipping] skipped: already sent`, { orderNumber, taskId });
		return { success: true, message: 'skipped: tracking email already sent' };
	}

	if (await hasTrackingEmailInProgress(orderNumber)) {
		console.log(`[wrikeShipping] skipped: already sending`, { orderNumber, taskId });
		return { success: true, message: 'skipped: already sending' };
	}

	// Legacy/secondary idempotency: description marker.
	if (task.description.includes('Shipping Confirmation Sent')) {
		console.log(`[wrikeShipping] skipped: tracking email already sent (task description marker)`, { orderNumber, taskId });
		return { success: true, message: 'skipped: tracking email already sent' };
	}

	const trackingNumberFieldId = process.env.WRIKE_TRACKING_NUMBER_FIELD_ID;
	if (!trackingNumberFieldId) {
		return { success: false, error: 'WRIKE_TRACKING_NUMBER_FIELD_ID not configured' };
	}

	const trackingNumberField = task.customFields?.find((f) => f.id === trackingNumberFieldId);
	const trackingNumberRaw = trackingNumberField?.value;
	const trackingNumber = normalizeTrackingNumber(trackingNumberRaw);

	console.log('[wrikeShipping] tracking number found', { orderNumber, taskId, trackingNumberRaw });
	console.log('[wrikeShipping] tracking number normalized', { orderNumber, taskId, trackingNumber });

	if (!trackingNumber) {
		console.log('[wrikeShipping] skipped: invalid tracking number (empty)', { orderNumber, taskId, trackingNumberRaw });
		return { success: true, message: 'skipped: invalid tracking number' };
	}
	if (trackingNumber === 'MANUAL' || trackingNumber === 'N/A' || trackingNumber === 'LOCAL' || trackingNumber === 'NONE') {
		console.log('[wrikeShipping] skipped: manual/local delivery', { orderNumber, taskId, trackingNumberRaw, trackingNumber });
		return { success: true, message: 'skipped: manual/local delivery' };
	}

	if (!isValidTrackingValue(trackingNumber)) {
		console.log(`[wrikeShipping] skipped: invalid tracking number`, { orderNumber, taskId, trackingNumberRaw, trackingNumber });
		return { success: true, message: 'skipped: invalid tracking number' };
	}

	await markTrackingEmailSendStarted({
		orderNumber,
		taskId,
		trackingNumber,
		via: 'webhook',
		route: 'wrike:webhook',
	});

	// Extract order data
	const orderData = extractOrderData(task, trackingNumber);
	if (!orderData) {
		await markTrackingEmailSendFailed({ orderNumber, error: 'Failed to extract order data from task' });
		return { success: false, error: 'Failed to extract order data from task' };
	}

	// Send shipping confirmation email
	const emailResult = await sendShippingConfirmation(orderData);

	if (emailResult.success) {
		console.log('[wrikeShipping] tracking email sent', { orderNumber: orderData.orderNumber, taskId, trackingNumber: orderData.trackingNumber });

		// Update task description to note that shipping confirmation was sent
		await updateTaskWithShippingConfirmation(taskId, orderData.trackingNumber);
		await markTrackingEmailSent({ orderNumber: orderData.orderNumber, taskId, trackingNumber: orderData.trackingNumber });

		return {
			success: true,
			message: `Shipping confirmation sent for order #${orderData.orderNumber}`,
		};
	} else {
		await markTrackingEmailSendFailed({ orderNumber, error: String(emailResult.error ?? 'unknown') });
		return {
			success: false,
			error: `Failed to send shipping confirmation: ${emailResult.error}`,
		};
	}
}

async function updateTaskWithShippingConfirmation(taskId: string, trackingNumber: string): Promise<void> {
	const apiToken = process.env.WRIKE_API_TOKEN;
	if (!apiToken) return;

	try {
		const task = await getWrikeTask(taskId);
		if (!task) return;

		// Add shipping confirmation note to description
		const confirmationNote = `<hr><h4>📧 Shipping Confirmation Sent</h4><p>Shipping confirmation email sent on ${new Date().toLocaleString('en-CA')} with tracking number: ${trackingNumber}</p>`;
		const updatedDescription = task.description + confirmationNote;

		const response = await fetch(`${WRIKE_API_BASE}/tasks/${taskId}`, {
			method: 'PUT',
			headers: {
				Authorization: `Bearer ${apiToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				description: updatedDescription,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			console.error('[wrikeShipping] Failed to update task description:', error);
		} else {
			console.log('[wrikeShipping] Task description updated with shipping confirmation note');
		}
	} catch (error) {
		console.error('[wrikeShipping] Error updating task description:', error);
	}
}

export async function triggerShippingConfirmationManually(orderNumber: string, trackingNumber: string): Promise<{ success: boolean; message?: string; error?: string }> {
	const apiToken = process.env.WRIKE_API_TOKEN;
	const ordersFolderId = process.env.WRIKE_ORDERS_FOLDER_ID;

	if (!apiToken || !ordersFolderId) {
		return { success: false, error: 'Wrike not configured' };
	}

	try {
		// Search for the order task
		const response = await fetch(`${WRIKE_API_BASE}/folders/${ordersFolderId}/tasks`, {
			headers: { Authorization: `Bearer ${apiToken}` },
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to fetch tasks: ${response.status} ${error}`);
		}

		const data = await response.json();
		const tasks = data.data || [];

		// Find the task with matching order number
		const orderTask = tasks.find((task: WrikeTask) => task.title.includes(`Order #${orderNumber}`));

		if (!orderTask) {
			return { success: false, error: `Order #${orderNumber} not found in Wrike` };
		}

		// Update tracking number in custom field
		const trackingNumberFieldId = process.env.WRIKE_TRACKING_NUMBER_FIELD_ID;
		if (trackingNumberFieldId) {
			await updateTaskTrackingNumber(orderTask.id, trackingNumber);
		}

		// Process shipping confirmation
		const result = await handleWrikeTaskCompletion({
			taskId: orderTask.id,
			newStatus: 'completed',
			folderId: ordersFolderId,
		});

		return result;
	} catch (error) {
		console.error('[wrikeShipping] Error in manual trigger:', error);
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}

async function updateTaskTrackingNumber(taskId: string, trackingNumber: string): Promise<void> {
	const apiToken = process.env.WRIKE_API_TOKEN;
	const trackingNumberFieldId = process.env.WRIKE_TRACKING_NUMBER_FIELD_ID;

	if (!apiToken || !trackingNumberFieldId) return;

	try {
		const response = await fetch(`${WRIKE_API_BASE}/tasks/${taskId}`, {
			method: 'PUT',
			headers: {
				Authorization: `Bearer ${apiToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				customFields: [
					{
						id: trackingNumberFieldId,
						value: trackingNumber,
					},
				],
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			console.error('[wrikeShipping] Failed to update tracking number:', error);
		} else {
			console.log('[wrikeShipping] Tracking number updated successfully');
		}
	} catch (error) {
		console.error('[wrikeShipping] Error updating tracking number:', error);
	}
}
