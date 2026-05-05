import { sendShippingConfirmation, ShippingConfirmationData } from './shippingEmail';

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

function extractOrderData(task: WrikeTask): ShippingConfirmationData | null {
	// Extract order number from title (format: "Order #12345 - John Doe")
	const titleMatch = task.title.match(/Order #(\d+)/);
	if (!titleMatch) {
		console.error('[wrikeShipping] Could not extract order number from task title:', task.title);
		return null;
	}

	const orderNumber = titleMatch[1];
	const trackingNumberFieldId = process.env.WRIKE_TRACKING_NUMBER_FIELD_ID;

	if (!trackingNumberFieldId) {
		console.error('[wrikeShipping] WRIKE_TRACKING_NUMBER_FIELD_ID not configured');
		return null;
	}

	// Extract tracking number from custom fields
	const trackingNumberField = task.customFields?.find((f) => f.id === trackingNumberFieldId);
	const trackingNumber = trackingNumberField?.value;

	if (!trackingNumber) {
		console.error('[wrikeShipping] No tracking number found for order #', orderNumber);
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

	// Only proceed if task is marked as completed
	if (newStatus.toLowerCase() !== 'completed') {
		return { success: true, message: 'Task not completed, skipping shipping confirmation' };
	}

	console.log(`[wrikeShipping] Processing completed task: ${taskId}`);

	// Get full task details
	const task = await getWrikeTask(taskId);
	if (!task) {
		return { success: false, error: 'Failed to fetch task details' };
	}

	// Verify this is an order task (should have "Order #" in title)
	if (!task.title.includes('Order #')) {
		return { success: true, message: 'Not an order task, skipping shipping confirmation' };
	}

	// Extract order data
	const orderData = extractOrderData(task);
	if (!orderData) {
		return { success: false, error: 'Failed to extract order data from task' };
	}

	// Send shipping confirmation email
	const emailResult = await sendShippingConfirmation(orderData);

	if (emailResult.success) {
		console.log(`[wrikeShipping] Shipping confirmation sent for order #${orderData.orderNumber}`);

		// Update task description to note that shipping confirmation was sent
		await updateTaskWithShippingConfirmation(taskId, orderData.trackingNumber);

		return {
			success: true,
			message: `Shipping confirmation sent for order #${orderData.orderNumber}`,
		};
	} else {
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
