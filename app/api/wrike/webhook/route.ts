import { NextRequest, NextResponse } from 'next/server';
import { handleWrikeTaskCompletion } from '@/lib/wrikeShipping';
import { completeManualEtransferOrder } from '@/lib/friendsFamilyOrderCompletion';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type WrikeWebhookEvent = {
	webhookId?: string;
	eventAuthorId?: string;
	eventType?: string;
	lastUpdatedDate?: string;
	taskId?: string;
	oldStatus?: string;
	status?: string;
	oldCustomStatusId?: string;
	customStatusId?: string;
	customFieldId?: string;
	value?: string;
	requestType?: string;
};

async function getWrikeOrderNumber(taskId: string): Promise<string> {
	const apiToken = process.env.WRIKE_API_TOKEN;
	if (!apiToken) return '';
	const apiBase = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';
	const response = await fetch(`${apiBase}/tasks/${encodeURIComponent(taskId)}`, {
		headers: { Authorization: `Bearer ${apiToken}` },
	});
	if (!response.ok) {
		console.error(`[wrikeWebhook] Failed to load task ${taskId}: ${response.status}`);
		return '';
	}
	const data = (await response.json()) as { data?: Array<{ title?: string }> };
	const title = String(data.data?.[0]?.title ?? '');
	return title.match(/Order #(\S+)/)?.[1]?.trim() ?? '';
}

function computeHmacSha256Hex(secret: string, data: string) {
	return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

function parseWrikeCustomFieldValue(value: string | undefined): string {
	const raw = String(value ?? '').trim();
	if (!raw) return '';
	try {
		const parsed = JSON.parse(raw);
		return typeof parsed === 'string' ? parsed.trim() : String(parsed ?? '').trim();
	} catch {
		return raw.replace(/^"|"$/g, '').trim();
	}
}

export async function POST(request: NextRequest) {
	try {
		const rawBody = await request.text();
		const webhookSecret = process.env.WRIKE_WEBHOOK_SECRET;

		let parsed: unknown;
		try {
			parsed = JSON.parse(rawBody);
		} catch {
			console.error('[wrikeWebhook] Invalid JSON body');
			return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
		}

		// Handle Wrike handshake verification
		const hookSecret = request.headers.get('X-Hook-Secret');
		const hookSignature = request.headers.get('X-Hook-Signature');

		// Check if this is a handshake request
		const isHandshake = hookSecret && parsed && typeof parsed === 'object' && (parsed as { requestType?: string }).requestType === 'WebHook secret verification';

		if (isHandshake) {
			console.log('[wrikeWebhook] Handshake request received');

			if (webhookSecret) {
				// Verify the signature of the request body
				if (!hookSignature) {
					console.error('[wrikeWebhook] Missing X-Hook-Signature in handshake');
					return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
				}

				const expectedSignature = computeHmacSha256Hex(webhookSecret, rawBody);
				if (hookSignature !== expectedSignature) {
					console.error('[wrikeWebhook] Invalid X-Hook-Signature in handshake');
					return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
				}

				// Signature is valid, now compute HMAC of the X-Hook-Secret VALUE
				const responseHookSecret = computeHmacSha256Hex(webhookSecret, hookSecret);
				console.log('[wrikeWebhook] Handshake successful with secret');
				return new NextResponse(null, {
					status: 200,
					headers: {
						'X-Hook-Secret': responseHookSecret,
					},
				});
			} else {
				// No secret configured, just respond with 200
				console.log('[wrikeWebhook] Handshake successful without secret');
				return new NextResponse(null, {
					status: 200,
				});
			}
		}

		// Verify signature for regular webhook events (if secret is configured)
		if (webhookSecret) {
			const signature = request.headers.get('X-Hook-Signature');
			if (!signature) {
				// No signature - could be Wrike's initial URL accessibility check
				// Return 200 to pass the check
				console.log('[wrikeWebhook] No signature - treating as URL accessibility check');
				return NextResponse.json({ ok: true, message: 'Webhook endpoint ready' });
			}
			const expected = computeHmacSha256Hex(webhookSecret, rawBody);
			if (signature !== expected) {
				console.error('[wrikeWebhook] Invalid X-Hook-Signature');
				return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
			}
		}

		const events: WrikeWebhookEvent[] = Array.isArray(parsed) ? (parsed as WrikeWebhookEvent[]) : [parsed as WrikeWebhookEvent];
		console.log('[wrikeWebhook] Received webhook events:', JSON.stringify(events, null, 2));

		let processed = 0;
		let failed = 0;

		for (const ev of events) {
			if (!ev.taskId) continue;

			if (ev.eventType === 'TaskCustomFieldChanged') {
				const paymentStatusFieldId = String(process.env.WRIKE_PAYMENT_STATUS_FIELD_ID ?? '').trim();
				const paymentStatusValue = parseWrikeCustomFieldValue(ev.value).toLowerCase();
				if (!paymentStatusFieldId || ev.customFieldId !== paymentStatusFieldId || paymentStatusValue !== 'transferred') continue;

				const orderNumber = await getWrikeOrderNumber(ev.taskId);
				if (!orderNumber) {
					console.error(`[wrikeWebhook] Could not extract order number from payment-transferred task ${ev.taskId}`);
					failed += 1;
					continue;
				}
				try {
					const completion = await completeManualEtransferOrder(orderNumber, ev.taskId);
					if (completion.ok) processed += 1;
					else {
						console.error(`[wrikeWebhook] Manual e-transfer completion skipped for #${orderNumber}: ${completion.error}`);
						failed += 1;
					}
				} catch (error) {
					console.error(`[wrikeWebhook] Manual e-transfer completion failed for #${orderNumber}:`, error);
					failed += 1;
				}
				continue;
			}

			if (ev?.eventType !== 'TaskStatusChanged') continue;
			const oldStatus = ev.oldStatus;
			const newStatus = ev.status;
			if (!newStatus) continue;

			console.log(`[wrikeWebhook] Task ${ev.taskId} status changed from ${oldStatus ?? 'unknown'} to ${newStatus}`);
			const result = await handleWrikeTaskCompletion({
				taskId: ev.taskId,
				oldStatus,
				newStatus,
				folderId: process.env.WRIKE_ORDERS_FOLDER_ID ?? '',
			});

			if (result.success) processed += 1;
			else failed += 1;
		}

		return NextResponse.json({
			success: true,
			processed,
			failed,
		});
	} catch (error) {
		console.error('[wrikeWebhook] Error processing webhook:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

export async function GET(request: NextRequest) {
	// Webhook verification endpoint
	return NextResponse.json({
		status: 'Wrike webhook endpoint is active',
		timestamp: new Date().toISOString(),
	});
}
