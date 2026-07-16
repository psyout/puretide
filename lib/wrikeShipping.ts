import { sendShippingConfirmation, ShippingConfirmationData } from './shippingEmail';
import { getAnyShippingEmailRecordForOrder, getOrderByOrderNumberFromDb, getShippingEmailRecord, insertShippingEmailRecord, upsertOrderInDb } from './ordersDb';

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

export type ShippingDryRunReport = {
	ok: boolean;
	input: {
		orderNumber?: string;
		taskId?: string;
		trackingNumberProvided?: string;
	};
	wrike: {
		configuredTrackingFieldId?: string;
		taskFound: boolean;
		taskId?: string;
		title?: string;
		status?: string;
		selectedCustomFieldId?: string;
		rawTrackingValue?: string | null;
		normalizedTrackingValue?: string;
		customFieldsCount?: number;
	};
	sqlite: {
		orderFound: boolean;
		orderNumber?: string;
		customerEmail?: string;
		customerName?: string;
	};
	idempotency: {
		trackingEmailSentAt?: string | null;
		trackingEmailSentTrackingNumber?: string | null;
		trackingEmailSendStartedAt?: string | null;
		trackingEmailSendStartedTrackingNumber?: string | null;
		alreadySentForSameTracking: boolean;
		alreadySentForDifferentTracking: boolean;
		inProgress: boolean;
	};
	decision: {
		wouldSend: boolean;
		reason: string;
	};
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
	if (normalized === 'MANUAL' || normalized === 'N/A' || normalized === 'NA' || normalized === 'LOCAL' || normalized === 'NONE') return false;
	if (normalized === 'PGCA') return false;
	// Canada Post tracking (as used in Wrike):
	// Common formats used by the business:
	// - 2 letters + 9 digits + CA (e.g., PG754389530CA, MW580076525CA)
	// Allow any 2-letter service prefix (do not restrict to PG only).
	if (!/^[A-Z]{2}\d{9}CA$/i.test(normalized)) return false;
	return true;
}

function extractOrderNumberFromWrikeTitle(title: string): string {
	const match = String(title ?? '').match(/Order #(\S+)/);
	return match?.[1] ? String(match[1]).trim() : '';
}

async function buildShippingConfirmationDataFromSqlite(params: { orderNumber: string; trackingNumber: string }): Promise<ShippingConfirmationData | null> {
	const order = await getOrderByOrderNumberFromDb(params.orderNumber);
	if (!order) return null;
	const customer = (order as { customer?: unknown }).customer as { firstName?: unknown; lastName?: unknown; email?: unknown } | undefined;
	const customerEmail = customer?.email != null ? String(customer.email).trim() : '';
	const customerName = `${customer?.firstName != null ? String(customer.firstName).trim() : ''} ${customer?.lastName != null ? String(customer.lastName).trim() : ''}`.trim();
	if (!customerEmail) return null;
	return {
		orderNumber: params.orderNumber,
		customerEmail,
		customerName,
		trackingNumber: params.trackingNumber,
		shippingMethod: 'express',
	};
}

export type ShippingProcessParams = {
	via: 'webhook' | 'cron';
	route: string;
	taskId?: string;
	orderNumber?: string;
	trackingNumberOverride?: string;
	dryRun?: boolean;
};

export async function processShippingConfirmation(params: ShippingProcessParams): Promise<{
	ok: boolean;
	message: string;
	report?: ShippingDryRunReport;
}> {
	const orderNumberInput = params.orderNumber ? String(params.orderNumber).trim() : '';
	const taskIdInput = params.taskId ? String(params.taskId).trim() : '';
	const trackingOverride = params.trackingNumberOverride ? normalizeTrackingNumber(params.trackingNumberOverride) : '';

	const task = taskIdInput ? await getWrikeTaskWithCustomFields({ taskId: taskIdInput }) : orderNumberInput ? await getWrikeTaskWithCustomFields({ orderNumber: orderNumberInput }) : null;

	const configuredTrackingFieldId = process.env.WRIKE_TRACKING_NUMBER_FIELD_ID;
	const customFields = Array.isArray(task?.customFields) ? task!.customFields : [];
	const selectedTrackingField = configuredTrackingFieldId ? customFields.find((f) => String(f.id) === String(configuredTrackingFieldId)) : undefined;
	const trackingRaw = selectedTrackingField?.value ?? null;
	const trackingNormalized = trackingOverride || normalizeTrackingNumber(trackingRaw);

	const orderNumberFromTask = task?.title ? extractOrderNumberFromWrikeTitle(task.title) : '';
	const orderNumber = orderNumberInput || orderNumberFromTask;

	const status = task?.status ? String(task.status) : '';
	const isCompleted = status.toLowerCase() === 'completed';

	console.log('[shippingConfirmation] inspect', {
		via: params.via,
		route: params.route,
		taskId: task?.id ?? taskIdInput ?? null,
		orderNumber: orderNumber || null,
		status: status || null,
		configuredTrackingFieldId: configuredTrackingFieldId ?? null,
		selectedCustomFieldId: selectedTrackingField?.id ?? null,
		trackingRaw,
		trackingNormalized,
		customFieldsCount: customFields.length,
	});

	const report = await dryRunShippingConfirmation({
		orderNumber: orderNumber || undefined,
		taskId: (task?.id ?? taskIdInput) || undefined,
		trackingNumber: trackingOverride || undefined,
	});

	if (params.dryRun) {
		return { ok: true, message: 'dry-run', report };
	}

	if (!task) return { ok: true, message: 'skipped: wrike task not found' };
	if (!isCompleted) return { ok: true, message: 'skipped: task not completed' };
	if (!orderNumber) return { ok: true, message: 'skipped: order number not found' };
	if (!trackingNormalized) return { ok: true, message: 'skipped: tracking missing/empty' };
	if (!isValidTrackingValue(trackingNormalized)) return { ok: true, message: 'skipped: invalid tracking number' };

	const alreadySentExact = await getShippingEmailRecord(orderNumber, trackingNormalized);
	if (alreadySentExact) {
		console.log('[shippingConfirmation] skipped: already sent for same tracking', {
			orderNumber,
			taskId: task.id,
			trackingNumber: trackingNormalized,
			sentAt: alreadySentExact.sentAt,
		});
		return { ok: true, message: 'skipped: already sent for same tracking' };
	}
	const anySent = await getAnyShippingEmailRecordForOrder(orderNumber);
	if (anySent && normalizeTrackingNumber(anySent.trackingNumber) !== trackingNormalized) {
		console.log('[shippingConfirmation] skipped: already sent for different tracking (no correction resend policy)', {
			orderNumber,
			taskId: task.id,
			trackingNumber: trackingNormalized,
			previousTrackingNumber: anySent.trackingNumber,
			previousSentAt: anySent.sentAt,
		});
		return { ok: true, message: 'skipped: already sent for different tracking (correction resend disabled)' };
	}

	if (await hasTrackingEmailInProgress(orderNumber)) {
		return { ok: true, message: 'skipped: already sending' };
	}

	await markTrackingEmailSendStarted({
		orderNumber,
		taskId: task.id,
		trackingNumber: trackingNormalized,
		via: params.via,
		route: params.route,
	});

	const orderData = await buildShippingConfirmationDataFromSqlite({ orderNumber, trackingNumber: trackingNormalized });
	if (!orderData) {
		await markTrackingEmailSendFailed({ orderNumber, error: 'sqlite order not found or customer email missing' });
		return { ok: false, message: 'sqlite order not found or customer email missing' };
	}

	const emailResult = await sendShippingConfirmation(orderData);
	if (!emailResult.success) {
		await markTrackingEmailSendFailed({ orderNumber, error: String(emailResult.error ?? 'unknown') });
		return { ok: false, message: `failed to send: ${emailResult.error}` };
	}

	await insertShippingEmailRecord({
		orderNumber,
		trackingNumber: trackingNormalized,
		sentAt: new Date().toISOString(),
		wrikeTaskId: task.id,
		via: params.via,
		route: params.route,
		customerEmail: orderData.customerEmail,
	});

	await updateTaskWithShippingConfirmation(task.id, trackingNormalized);
	await markTrackingEmailSent({
		orderNumber,
		taskId: task.id,
		trackingNumber: trackingNormalized,
		customerEmail: orderData.customerEmail,
		via: params.via,
		route: params.route,
	});

	return { ok: true, message: `sent shipping confirmation for order #${orderNumber}` };
}

async function getWrikeTaskWithCustomFields(params: { taskId: string } | { orderNumber: string }): Promise<WrikeTask | null> {
	const apiToken = process.env.WRIKE_API_TOKEN;
	const ordersFolderId = process.env.WRIKE_ORDERS_FOLDER_ID;
	if (!apiToken || !ordersFolderId) return null;

	try {
		const response = await fetch(`${WRIKE_API_BASE}/folders/${encodeURIComponent(ordersFolderId)}/tasks?fields=['description','customFields']`, {
			headers: { Authorization: `Bearer ${apiToken}` },
		});
		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to fetch folder tasks: ${response.status} ${error}`);
		}
		const data = (await response.json()) as { data?: WrikeTask[] };
		const tasks: WrikeTask[] = Array.isArray(data.data) ? data.data : [];
		if ('taskId' in params) {
			return tasks.find((t) => String(t.id) === String(params.taskId)) ?? null;
		}
		return tasks.find((t) => String(t.title ?? '').includes(`Order #${params.orderNumber}`)) ?? null;
	} catch (error) {
		console.error('[wrikeShipping] Error fetching Wrike task with custom fields:', error);
		return null;
	}
}

export async function dryRunShippingConfirmation(params: { orderNumber?: string; taskId?: string; trackingNumber?: string }): Promise<ShippingDryRunReport> {
	const orderNumberRaw = params.orderNumber ? String(params.orderNumber).trim() : '';
	const taskIdRaw = params.taskId ? String(params.taskId).trim() : '';
	const trackingProvidedRaw = params.trackingNumber ? String(params.trackingNumber) : '';
	const trackingProvidedNormalized = trackingProvidedRaw ? normalizeTrackingNumber(trackingProvidedRaw) : '';

	if (!orderNumberRaw && !taskIdRaw) {
		return {
			ok: false,
			input: { orderNumber: orderNumberRaw || undefined, taskId: taskIdRaw || undefined, trackingNumberProvided: trackingProvidedRaw || undefined },
			wrike: { taskFound: false },
			sqlite: { orderFound: false },
			idempotency: {
				alreadySentForSameTracking: false,
				alreadySentForDifferentTracking: false,
				inProgress: false,
			},
			decision: { wouldSend: false, reason: 'missing required input: orderNumber or taskId' },
		};
	}

	const configuredTrackingFieldId = process.env.WRIKE_TRACKING_NUMBER_FIELD_ID;
	const task = taskIdRaw ? await getWrikeTaskWithCustomFields({ taskId: taskIdRaw }) : await getWrikeTaskWithCustomFields({ orderNumber: orderNumberRaw });
	const customFields = Array.isArray(task?.customFields) ? task!.customFields : [];
	const selected = configuredTrackingFieldId ? customFields.find((f) => String(f.id) === String(configuredTrackingFieldId)) : undefined;
	const trackingRaw = selected?.value ?? null;
	const trackingNormalized = trackingProvidedNormalized || normalizeTrackingNumber(trackingRaw);

	const extractedOrderNumber = (() => {
		if (orderNumberRaw) return orderNumberRaw;
		const title = task?.title ? String(task.title) : '';
		const match = title.match(/Order #(\S+)/);
		return match?.[1] ? String(match[1]).trim() : '';
	})();

	const order = extractedOrderNumber ? await getOrderByOrderNumberFromDb(extractedOrderNumber) : null;
	const customer = (order as { customer?: unknown } | null)?.customer as { firstName?: unknown; lastName?: unknown; email?: unknown } | undefined;
	const customerEmail = customer?.email != null ? String(customer.email).trim() : '';
	const customerName = `${customer?.firstName != null ? String(customer.firstName).trim() : ''} ${customer?.lastName != null ? String(customer.lastName).trim() : ''}`.trim();

	const sentExact = extractedOrderNumber && trackingNormalized ? await getShippingEmailRecord(extractedOrderNumber, trackingNormalized) : null;
	const sentAny = extractedOrderNumber ? await getAnyShippingEmailRecordForOrder(extractedOrderNumber) : null;
	const sentAt = sentExact?.sentAt ?? sentAny?.sentAt ?? null;
	const sentTracking = sentAny?.trackingNumber ?? null;
	const startedAt = order && 'trackingEmailSendStartedAt' in order ? String((order as Record<string, unknown>).trackingEmailSendStartedAt ?? '') : '';
	const startedTracking = order && 'trackingEmailSendStartedTrackingNumber' in order ? String((order as Record<string, unknown>).trackingEmailSendStartedTrackingNumber ?? '') : '';

	const alreadySentForSameTracking = Boolean(sentExact);
	const alreadySentForDifferentTracking = Boolean(sentAny && trackingNormalized) && normalizeTrackingNumber(sentAny!.trackingNumber) !== trackingNormalized;
	const inProgress = extractedOrderNumber ? await hasTrackingEmailInProgress(extractedOrderNumber) : false;

	let wouldSend = true;
	let reason = 'eligible';
	if (!task) {
		wouldSend = false;
		reason = 'wrike task not found';
	} else if (String(task.status ?? '').toLowerCase() !== 'completed') {
		wouldSend = false;
		reason = 'task not completed';
	} else if (!trackingNormalized) {
		wouldSend = false;
		reason = 'tracking missing/empty';
	} else if (!isValidTrackingValue(trackingNormalized)) {
		wouldSend = false;
		reason = 'tracking invalid (validation failed)';
	} else if (!extractedOrderNumber) {
		wouldSend = false;
		reason = 'order number not found';
	} else if (!order) {
		wouldSend = false;
		reason = 'sqlite order not found';
	} else if (!customerEmail) {
		wouldSend = false;
		reason = 'customer email missing in sqlite order_json.customer';
	} else if (inProgress) {
		wouldSend = false;
		reason = 'tracking email send in progress';
	} else if (alreadySentForSameTracking) {
		wouldSend = false;
		reason = 'already sent for same tracking';
	} else if (alreadySentForDifferentTracking) {
		wouldSend = false;
		reason = 'already sent for different tracking (correction policy not implemented)';
	}

	return {
		ok: true,
		input: {
			orderNumber: orderNumberRaw || undefined,
			taskId: taskIdRaw || undefined,
			trackingNumberProvided: trackingProvidedRaw || undefined,
		},
		wrike: {
			configuredTrackingFieldId: configuredTrackingFieldId || undefined,
			taskFound: Boolean(task),
			taskId: task?.id,
			title: task?.title,
			status: task?.status,
			selectedCustomFieldId: selected?.id,
			rawTrackingValue: trackingRaw,
			normalizedTrackingValue: trackingNormalized,
			customFieldsCount: customFields.length,
		},
		sqlite: {
			orderFound: Boolean(order),
			orderNumber: extractedOrderNumber || undefined,
			customerEmail: customerEmail || undefined,
			customerName: customerName || undefined,
		},
		idempotency: {
			trackingEmailSentAt: sentAt,
			trackingEmailSentTrackingNumber: sentTracking,
			trackingEmailSendStartedAt: startedAt || null,
			trackingEmailSendStartedTrackingNumber: startedTracking || null,
			alreadySentForSameTracking,
			alreadySentForDifferentTracking,
			inProgress,
		},
		decision: {
			wouldSend,
			reason,
		},
	};
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
	shippingMethod?: 'express';
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

		const orderNumberFromTitle = task?.title ? extractOrderNumberFromWrikeTitle(task.title) : '';
		const orderNumber = orderNumberFromContext ?? orderNumberFromTitle ?? params.orderNumber;
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
				shippingMethod: params.shippingMethod ?? 'express',
			};
		} else {
			orderData = await buildShippingConfirmationDataFromSqlite({ orderNumber, trackingNumber });
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
	const anySent = await getAnyShippingEmailRecordForOrder(orderNumber);
	if (anySent) return true;
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
	const titleMatch = task.title.match(/Order #(\S+)/);
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
	const shippingMethod: 'express' = 'express';

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
	const result = await processShippingConfirmation({ via: 'webhook', route: 'wrike:webhook', taskId });
	if (result.ok) return { success: true, message: result.message };
	return { success: false, error: result.message };
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
