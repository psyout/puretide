import { NextRequest, NextResponse } from 'next/server';
import { sendShippingConfirmation } from '@/lib/shippingEmail';
import {
	hasTrackingEmailAlreadyBeenSent,
	hasTrackingEmailInProgress,
	isValidTrackingValue,
	markTrackingEmailSendFailed,
	markTrackingEmailSendStarted,
	markTrackingEmailSent,
	normalizeTrackingNumber,
} from '@/lib/wrikeShipping';
import { getOrderByOrderNumberFromDb } from '@/lib/ordersDb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SHIPPING_AUTOMATION_VERSION = '2026-06-23-07';

export async function GET(request: NextRequest) {
	const authHeader = request.headers.get('authorization');
	const cronSecret = process.env.CRON_SECRET;
	const debug = process.env.SHIPPING_AUTOMATION_DEBUG === '1';

	if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		console.log('[shippingAutomation] Starting automated shipping confirmation check');

		// Get Wrike API token and orders folder ID
		const apiToken = process.env.WRIKE_API_TOKEN;
		const ordersFolderId = process.env.WRIKE_ORDERS_FOLDER_ID;
		const trackingNumberFieldId = process.env.WRIKE_TRACKING_NUMBER_FIELD_ID;

		if (!apiToken || !ordersFolderId || !trackingNumberFieldId) {
			console.error('[shippingAutomation] Missing required configuration');
			return NextResponse.json({ error: 'Missing configuration' }, { status: 500 });
		}

		if (debug) {
			console.log('[shippingAutomation] config', {
				ordersFolderId,
				trackingNumberFieldId,
				lookbackHours: process.env.SHIPPING_AUTOMATION_LOOKBACK_HOURS,
			});
		}

		const { searchParams } = new URL(request.url);
		const debugTaskId = searchParams.get('taskId');
		if (debugTaskId) {
			// Wrike's tasks/{id} endpoint does not allow requesting customFields via the `fields` parameter.
			// Use the folder task listing (same API we use in the main cron path) and locate the task by id.
			const taskUrl = `https://www.wrike.com/api/v4/folders/${encodeURIComponent(ordersFolderId)}/tasks?fields=['description','customFields']`;
			const taskResp = await fetch(taskUrl, {
				headers: { Authorization: `Bearer ${apiToken}` },
			});
			const taskText = await taskResp.text();
			if (!taskResp.ok) {
				return NextResponse.json({ error: 'Failed to fetch folder tasks', url: taskUrl, status: taskResp.status, details: taskText.slice(0, 2000) }, { status: 500 });
			}
			let taskJson: { data?: Array<Record<string, unknown>> };
			try {
				taskJson = JSON.parse(taskText) as { data?: Array<Record<string, unknown>> };
			} catch {
				return NextResponse.json({ error: 'Wrike folder tasks response was not valid JSON', url: taskUrl, status: taskResp.status, details: taskText.slice(0, 2000) }, { status: 500 });
			}
			const debugTaskIdStr = String(debugTaskId);
			let matchedBy: 'id' | 'permalink' | null = null;
			let task = (taskJson.data ?? []).find((item) => {
				const record = item as { id?: unknown; permalink?: unknown; permalinkUrl?: unknown };
				const idStr = String(record.id ?? '');
				if (idStr && idStr === debugTaskIdStr) {
					matchedBy = 'id';
					return true;
				}
				const permalink = String(record.permalink ?? record.permalinkUrl ?? '');
				if (permalink && permalink.includes(debugTaskIdStr)) {
					matchedBy = 'permalink';
					return true;
				}
				return false;
			}) as
				| {
						id?: unknown;
						title?: unknown;
						status?: unknown;
						updatedDate?: unknown;
						customFields?: Array<{ id?: unknown; value?: unknown }>;
						permalink?: unknown;
						permalinkUrl?: unknown;
				  }
				| undefined;

			if (!task) {
				// Fallback: task may not be in the configured orders folder (moved, created elsewhere, or folderId misconfigured).
				// Try fetching the task directly so we can still inspect custom fields.
				const directTaskUrlWithFields = `https://www.wrike.com/api/v4/tasks/${encodeURIComponent(debugTaskId)}?fields=['customFields','description']`;
				const directRespWithFields = await fetch(directTaskUrlWithFields, {
					headers: { Authorization: `Bearer ${apiToken}` },
				});
				const directTextWithFields = await directRespWithFields.text();
				if (directRespWithFields.ok) {
					let directJson: { data?: Array<Record<string, unknown>> };
					try {
						directJson = JSON.parse(directTextWithFields) as { data?: Array<Record<string, unknown>> };
						task = directJson.data?.[0] as typeof task;
					} catch {
						return NextResponse.json(
							{
								error: 'Wrike direct task response was not valid JSON',
								version: SHIPPING_AUTOMATION_VERSION,
								debugTaskId,
								url: directTaskUrlWithFields,
								details: directTextWithFields.slice(0, 2000),
							},
							{ status: 500 },
						);
					}
				} else {
					const directTaskUrlNoFields = `https://www.wrike.com/api/v4/tasks/${encodeURIComponent(debugTaskId)}`;
					const directRespNoFields = await fetch(directTaskUrlNoFields, {
						headers: { Authorization: `Bearer ${apiToken}` },
					});
					const directTextNoFields = await directRespNoFields.text();
					if (!directRespNoFields.ok) {
						return NextResponse.json(
							{
								error: 'Task not found in orders folder and direct task fetch failed',
								version: SHIPPING_AUTOMATION_VERSION,
								debugTaskId,
								ordersFolderId,
								configuredTrackingFieldId: trackingNumberFieldId,
								folderFetchUrl: taskUrl,
								directFetchUrlAttempted: directTaskUrlWithFields,
								directFetchWithFieldsStatus: directRespWithFields.status,
								directFetchWithFieldsDetails: directTextWithFields.slice(0, 2000),
								directFetchNoFieldsUrl: directTaskUrlNoFields,
								directFetchNoFieldsStatus: directRespNoFields.status,
								directFetchNoFieldsDetails: directTextNoFields.slice(0, 2000),
							},
							{ status: 404 },
						);
					}
					let directJson: { data?: Array<Record<string, unknown>> };
					try {
						directJson = JSON.parse(directTextNoFields) as { data?: Array<Record<string, unknown>> };
						task = directJson.data?.[0] as typeof task;
					} catch {
						return NextResponse.json(
							{
								error: 'Wrike direct task (no fields) response was not valid JSON',
								version: SHIPPING_AUTOMATION_VERSION,
								debugTaskId,
								url: directTaskUrlNoFields,
								details: directTextNoFields.slice(0, 2000),
							},
							{ status: 500 },
						);
					}
				}
			}

			if (!task) {
				return NextResponse.json(
					{
						error: 'Task not found',
						version: SHIPPING_AUTOMATION_VERSION,
						debugTaskId,
						ordersFolderId,
						configuredTrackingFieldId: trackingNumberFieldId,
					},
					{ status: 404 },
				);
			}
			const customFields = Array.isArray(task?.customFields) ? task!.customFields : [];
			const selected = customFields.find((f) => String(f.id ?? '') === String(trackingNumberFieldId));
			return NextResponse.json({
				ok: true,
				version: SHIPPING_AUTOMATION_VERSION,
				debugTaskId,
				matchedBy,
				configuredTrackingFieldId: trackingNumberFieldId,
				selectedTrackingFieldValue: selected?.value ?? null,
				customFields,
				task: {
					id: task?.id ?? null,
					title: task?.title ?? null,
					status: task?.status ?? null,
					updatedDate: task?.updatedDate ?? null,
					permalink: (task as { permalink?: unknown })?.permalink ?? null,
					permalinkUrl: (task as { permalinkUrl?: unknown })?.permalinkUrl ?? null,
				},
			});
		}

		// Fetch all tasks from the orders folder with custom fields
		const response = await fetch(`https://www.wrike.com/api/v4/folders/${ordersFolderId}/tasks?fields=['description','customFields']`, {
			headers: { Authorization: `Bearer ${apiToken}` },
		});

		if (!response.ok) {
			const error = await response.text();
			console.error('[shippingAutomation] Error fetching tasks:', response.status, error);
			return NextResponse.json({ error: 'Failed to fetch tasks', details: error, status: response.status }, { status: 500 });
		}

		const data = await response.json();
		const tasks = data.data ?? [];

		console.log(`[shippingAutomation] Found ${tasks.length} tasks in orders folder`);

		let processedCount = 0;
		let skippedAlreadySent = 0;
		let skippedInvalidTracking = 0;
		let skippedNotCompleted = 0;
		let skippedAlreadySending = 0;
		let skippedOld = 0;
		let skippedOrderNotFound = 0;
		let skippedCustomerEmailMissing = 0;
		let failedCount = 0;

		const lookbackHoursRaw = process.env.SHIPPING_AUTOMATION_LOOKBACK_HOURS;
		const lookbackHours = Number.isFinite(Number(lookbackHoursRaw)) && Number(lookbackHoursRaw) > 0 ? Number(lookbackHoursRaw) : 6;
		const lookbackMs = lookbackHours * 60 * 60 * 1000;

		for (const task of tasks) {
			// Check if task is "Completed" status
			if (task.status !== 'Completed') {
				skippedNotCompleted++;
				continue;
			}

			// Check if task has a tracking number
			const trackingNumberField = task.customFields?.find((f: { id: string }) => f.id === trackingNumberFieldId);
			const trackingNumber = trackingNumberField?.value;
			const trackingNumberNormalized = normalizeTrackingNumber(trackingNumber);
			const orderNumberFromTitle = (task.title?.match(/Order #(\S+)/) ?? [])[1];

			if (!trackingNumberNormalized) {
				console.log('[shippingAutomation] skipped: invalid or missing tracking number', {
					taskId: task.id,
					title: task.title,
					orderNumber: orderNumberFromTitle,
					selectedTrackingFieldId: trackingNumberFieldId,
					trackingNumberRaw: trackingNumber,
				});
				if (debug) {
					console.log('[shippingAutomation] debug customFields', {
						taskId: task.id,
						customFields: task.customFields ?? [],
					});
				}
				skippedInvalidTracking++;
				continue;
			}
			if (trackingNumberNormalized === 'MANUAL' || trackingNumberNormalized === 'N/A' || trackingNumberNormalized === 'LOCAL' || trackingNumberNormalized === 'NONE') {
				console.log('[shippingAutomation] skipped: manual/local delivery', {
					taskId: task.id,
					title: task.title,
					trackingNumberRaw: trackingNumber,
					trackingNumber: trackingNumberNormalized,
				});
				skippedInvalidTracking++;
				continue;
			}

			if (!isValidTrackingValue(trackingNumberNormalized)) {
				console.log('[shippingAutomation] skipped: invalid or missing tracking number', {
					taskId: task.id,
					title: task.title,
					orderNumber: orderNumberFromTitle,
					selectedTrackingFieldId: trackingNumberFieldId,
					trackingNumberRaw: trackingNumber,
					trackingNumber: trackingNumberNormalized,
				});
				if (debug) {
					console.log('[shippingAutomation] debug customFields', {
						taskId: task.id,
						customFields: task.customFields ?? [],
					});
				}
				skippedInvalidTracking++;
				continue;
			}

			// Check for shipping confirmation marker in description
			// Keep this aligned with the webhook pipeline's marker.
			if (task.description?.includes('Shipping Confirmation Sent')) {
				continue;
			}

			// Recency filter: do not send emails for old completed orders.
			// We only process tasks that were updated recently (usually means status just changed to Completed).
			const taskUpdated = task.updatedDate ? new Date(task.updatedDate) : null;
			const now = new Date();
			if (!taskUpdated || Number.isNaN(taskUpdated.getTime())) {
				console.log('[shippingAutomation] skipped: missing updatedDate', { taskId: task.id, title: task.title });
				skippedOld++;
				continue;
			}
			if (now.getTime() - taskUpdated.getTime() > lookbackMs) {
				console.log('[shippingAutomation] skipped: task too old', { taskId: task.id, title: task.title, updatedDate: task.updatedDate, lookbackHours });
				skippedOld++;
				continue;
			}
			if (now.getTime() - taskUpdated.getTime() < 60000) {
				// Skip if task was updated less than 1 minute ago (avoids race conditions)
				continue;
			}

			// Extract order number from title
			const titleMatch = task.title.match(/Order #(\S+)/);
			if (!titleMatch) {
				continue;
			}

			const orderNumber = titleMatch[1];
			console.log('[shippingAutomation] order number extracted', { orderNumber, taskId: task.id });

			if (await hasTrackingEmailAlreadyBeenSent(orderNumber)) {
				console.log('[shippingAutomation] skipped: tracking email already sent', { orderNumber, taskId: task.id });
				skippedAlreadySent++;
				continue;
			}

			if (await hasTrackingEmailInProgress(orderNumber)) {
				console.log('[shippingAutomation] skipped: already sending', { orderNumber, taskId: task.id });
				skippedAlreadySending++;
				continue;
			}

			console.log('[shippingAutomation] processing', { orderNumber, taskId: task.id, trackingNumber: trackingNumberNormalized });

			const order = await getOrderByOrderNumberFromDb(orderNumber);
			if (!order) {
				console.log('[shippingAutomation] skipped: order not found', { orderNumber, taskId: task.id });
				skippedOrderNotFound++;
				continue;
			}
			console.log('[shippingAutomation] order found in SQLite', { orderNumber, taskId: task.id });

			const customer = (order as { customer?: unknown }).customer as { firstName?: unknown; lastName?: unknown; email?: unknown } | undefined;
			const customerEmail = customer?.email != null ? String(customer.email).trim() : '';
			const customerName = `${customer?.firstName != null ? String(customer.firstName).trim() : ''} ${customer?.lastName != null ? String(customer.lastName).trim() : ''}`.trim();
			if (!customerEmail) {
				console.log('[shippingAutomation] skipped: customer email missing', { orderNumber, taskId: task.id });
				skippedCustomerEmailMissing++;
				continue;
			}
			console.log('[shippingAutomation] customer email found', { orderNumber, taskId: task.id, customerEmail });

			const shippingMethod = 'regular' as const;

			await markTrackingEmailSendStarted({
				orderNumber,
				taskId: String(task.id),
				trackingNumber: trackingNumberNormalized,
				via: 'cron',
				route: 'cron:shipping-automation',
			});

			// Send shipping confirmation email
			const emailResult = await sendShippingConfirmation({
				orderNumber,
				customerEmail,
				customerName,
				trackingNumber: trackingNumberNormalized,
				shippingMethod,
			});

			if (emailResult.success) {
				await markTrackingEmailSent({
					orderNumber,
					taskId: String(task.id),
					trackingNumber: trackingNumberNormalized,
					customerEmail,
					via: 'cron',
					route: 'cron:shipping-automation',
				});
				processedCount++;

				// Mark task as processed by adding a note to the description
				const updatedDescription = task.description
					? `${task.description}\n\n<p><i>Shipping Confirmation Sent: ${new Date().toISOString()}</i></p>`
					: `<p><i>Shipping Confirmation Sent: ${new Date().toISOString()}</i></p>`;

				// Update task description via Wrike API
				const updateResponse = await fetch(`https://www.wrike.com/api/v4/tasks/${task.id}`, {
					method: 'PUT',
					headers: {
						Authorization: `Bearer ${apiToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ description: updatedDescription }),
				});

				if (updateResponse.ok) {
					console.log('[shippingAutomation] sent', { orderNumber, taskId: task.id });
				} else {
					console.error('[shippingAutomation] warning: failed to update task description after send', { orderNumber, taskId: task.id });
				}
			} else {
				await markTrackingEmailSendFailed({ orderNumber, error: String(emailResult.error ?? 'unknown') });
				failedCount++;
				console.error('[shippingAutomation] failed to send', { orderNumber, taskId: task.id, error: emailResult.error });
			}
		}

		console.log('[shippingAutomation] Completed.', {
			processed: processedCount,
			skippedAlreadySent,
			skippedAlreadySending,
			skippedInvalidTracking,
			skippedNotCompleted,
			skippedOld,
			skippedOrderNotFound,
			skippedCustomerEmailMissing,
			failed: failedCount,
		});

		return NextResponse.json({
			success: true,
			version: SHIPPING_AUTOMATION_VERSION,
			processed: processedCount,
			skippedAlreadySent,
			skippedAlreadySending,
			skippedInvalidTracking,
			skippedNotCompleted,
			skippedOld,
			skippedOrderNotFound,
			skippedCustomerEmailMissing,
			failed: failedCount,
			totalTasks: tasks.length,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('[shippingAutomation] Error:', error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 },
		);
	}
}
