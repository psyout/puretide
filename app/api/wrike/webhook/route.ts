import { NextRequest, NextResponse } from 'next/server';
import { handleWrikeTaskCompletion } from '@/lib/wrikeShipping';
import crypto from 'node:crypto';

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
	requestType?: string;
};

function computeHmacSha256Hex(secret: string, data: string) {
	return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export async function POST(request: NextRequest) {
	try {
		const rawBody = await request.text();
		const webhookSecret = process.env.WRIKE_WEBHOOK_SECRET;

		// Secure webhooks: verify signature if configured
		if (webhookSecret) {
			const signature = request.headers.get('X-Hook-Signature');
			if (!signature) {
				console.error('[wrikeWebhook] Missing X-Hook-Signature header');
				return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 });
			}
			const expected = computeHmacSha256Hex(webhookSecret, rawBody);
			if (signature !== expected) {
				console.error('[wrikeWebhook] Invalid X-Hook-Signature');
				return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
			}
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(rawBody);
		} catch {
			console.error('[wrikeWebhook] Invalid JSON body');
			return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
		}

		// Secure webhook handshake: respond with X-Hook-Secret signature
		const hookSecret = request.headers.get('X-Hook-Secret');
		const isHandshake = hookSecret || (parsed && typeof parsed === 'object' && (parsed as { requestType?: string }).requestType === 'WebHook secret verification');

		if (isHandshake) {
			if (webhookSecret && hookSecret) {
				const responseHookSecret = computeHmacSha256Hex(webhookSecret, hookSecret);
				return new NextResponse(null, {
					status: 200,
					headers: {
						'X-Hook-Secret': responseHookSecret,
					},
				});
			} else {
				// No secret configured or Wrike handshake verification request
				// Respond with success to complete handshake
				return new NextResponse(null, {
					status: 200,
				});
			}
		}

		const events: WrikeWebhookEvent[] = Array.isArray(parsed) ? (parsed as WrikeWebhookEvent[]) : [parsed as WrikeWebhookEvent];
		console.log('[wrikeWebhook] Received webhook events:', JSON.stringify(events, null, 2));

		let processed = 0;
		let failed = 0;

		for (const ev of events) {
			if (ev?.eventType !== 'TaskStatusChanged') continue;
			if (!ev.taskId) continue;

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
