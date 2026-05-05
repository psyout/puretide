import { NextRequest, NextResponse } from 'next/server';
import { sendShippingConfirmation } from '@/lib/shippingEmail';

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
		const response = await fetch(`https://www.wrike.com/api/v4/folders/${ordersFolderId}/tasks?fields=['description','customFields','status']`, {
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

		for (const task of tasks) {
			// Check if task is "Completed" status
			if (task.status !== 'Completed') {
				continue;
			}

			// Check if task has a tracking number
			const trackingNumberField = task.customFields?.find((f: { id: string }) => f.id === trackingNumberFieldId);
			const trackingNumber = trackingNumberField?.value;

			if (!trackingNumber) {
				continue;
			}

			// Check if shipping email already sent (using a custom field or description marker)
			// For now, we'll check if the description contains "Shipping email sent"
			if (task.description?.includes('Shipping email sent')) {
				continue;
			}

			// Extract order number from title
			const titleMatch = task.title.match(/Order #(\S+)/);
			if (!titleMatch) {
				continue;
			}

			const orderNumber = titleMatch[1];

			console.log(`[shippingAutomation] Processing order #${orderNumber} with tracking number ${trackingNumber}`);

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

			// Send shipping confirmation email
			const success = await sendShippingConfirmation({
				orderNumber,
				customerEmail,
				customerName,
				trackingNumber,
				shippingMethod,
			});

			if (success) {
				// Mark task as processed by adding a note to the description
				const updatedDescription = task.description
					? `${task.description}\n\n<p><i>Shipping email sent: ${new Date().toISOString()}</i></p>`
					: `<p><i>Shipping email sent: ${new Date().toISOString()}</i></p>`;

				// Update task description via Wrike API
				await fetch(`https://www.wrike.com/api/v4/tasks/${task.id}`, {
					method: 'PUT',
					headers: {
						Authorization: `Bearer ${apiToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ description: updatedDescription }),
				});

				processedCount++;
				console.log(`[shippingAutomation] Shipping confirmation sent for order #${orderNumber}`);
			} else {
				console.error(`[shippingAutomation] Failed to send shipping confirmation for order #${orderNumber}`);
			}
		}

		console.log(`[shippingAutomation] Completed. Processed ${processedCount} orders.`);

		return NextResponse.json({
			success: true,
			processed: processedCount,
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
