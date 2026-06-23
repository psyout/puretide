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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
	const authHeader = request.headers.get('authorization');
	const cronSecret = process.env.CRON_SECRET;

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
		let failedCount = 0;

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

			if (!trackingNumberNormalized) {
				console.log('[shippingAutomation] skipped: invalid or missing tracking number', { taskId: task.id, title: task.title, trackingNumberRaw: trackingNumber });
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

			if (!isValidTrackingValue(trackingNumber)) {
				console.log('[shippingAutomation] skipped: invalid or missing tracking number', {
					taskId: task.id,
					title: task.title,
					trackingNumberRaw: trackingNumber,
					trackingNumber: trackingNumberNormalized,
				});
				skippedInvalidTracking++;
				continue;
			}

			// Check for shipping confirmation marker in description
			// Keep this aligned with the webhook pipeline's marker.
			if (task.description?.includes('Shipping Confirmation Sent')) {
				continue;
			}

			// Also check if the task was updated recently (to avoid processing same task multiple times in quick succession)
			const taskUpdated = task.updatedDate ? new Date(task.updatedDate) : null;
			const now = new Date();
			if (taskUpdated && now.getTime() - taskUpdated.getTime() < 60000) {
				// Skip if task was updated less than 1 minute ago (avoids race conditions)
				continue;
			}

			// Extract order number from title
			const titleMatch = task.title.match(/Order #(\S+)/);
			if (!titleMatch) {
				continue;
			}

			const orderNumber = titleMatch[1];

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

			// Extract customer details from task description
			const description = task.description || '';
			const emailMatch = description.match(/<b>Email:<\/b> ([^<]+)/);
			const nameMatch = description.match(/<b>Name:<\/b> ([^<]+)/);
			const shippingMethodMatch = description.match(/Shipping \(([^)]+)\)/);

			if (!emailMatch || !nameMatch) {
				console.error(`[shippingAutomation] Could not extract customer details for order #${orderNumber}`);
				continue;
			}

			// Decode HTML entities (e.g., &#64; -> @)
			const decodeHtmlEntities = (text: string): string => {
				return text.replace(/&#(\d+);/g, (_match: string, dec: string) => String.fromCharCode(parseInt(dec, 10)));
			};

			const customerEmail = decodeHtmlEntities(emailMatch[1].trim());
			const customerName = nameMatch[1].trim();
			const shippingMethod = shippingMethodMatch?.[1]?.includes('express') ? 'express' : 'regular';

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
			failed: failedCount,
		});

		return NextResponse.json({
			success: true,
			processed: processedCount,
			skippedAlreadySent,
			skippedAlreadySending,
			skippedInvalidTracking,
			skippedNotCompleted,
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
