import { NextResponse } from 'next/server';
import { getOrderBySessionFromDb, upsertOrderInDb } from '@/lib/ordersDb';
import { runFulfillment, type FulfillmentOrder } from '@/lib/orderFulfillment';
import { createRetryJobForOrder } from '@/lib/retryJobs';
import { validateOrderStateTransition, type OrderPaymentStatus } from '@/lib/orderComputation';
import { getPaymentProvider } from '@/lib/paymentProvider';
import { getGatewaylinxConfig } from '@/lib/env';
import { validateEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
	'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
	Pragma: 'no-cache',
	Expires: '0',
} as const;

function json(body: unknown, init: ResponseInit = {}) {
	const headers = new Headers(init.headers);
	for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
		headers.set(key, value);
	}
	return NextResponse.json(body, { ...init, headers });
}

export async function POST(request: Request) {
	// Validate environment before processing
	validateEnv();

	try {
		// Use provider abstraction to validate the postback
		const provider = getPaymentProvider();
		const gatewaylinxConfig = getGatewaylinxConfig();
		const isGatewaylinx = !!gatewaylinxConfig;

		const result = await provider.validatePaymentNotification(request);

		if (!result.ok) {
			console.warn(JSON.stringify({ label: 'creditcard:webhook:validation_failed', orderNumber: result.orderNumber }));
			return json({ ok: false, error: 'Validation failed' }, { status: 400 });
		}

		// Load order
		const order = await getOrderBySessionFromDb(result.orderNumber);
		if (!order) {
			console.warn(JSON.stringify({ label: 'creditcard:webhook:unknown_order', orderNumber: result.orderNumber }));
			return json({ ok: false, error: 'Unknown order' }, { status: 404 });
		}

		// Check if order already paid (idempotency)
		if (order.paymentStatus === 'paid') {
			console.log(JSON.stringify({ label: 'creditcard:webhook:already_paid', orderNumber: result.orderNumber }));
			return json({ ok: true, message: 'Order already processed' });
		}

		// For interim statuses (e.g., 3ds_required), return 200 but don't mark as paid
		if (result.rawStatus && result.rawStatus !== 'approved') {
			console.log(JSON.stringify({ label: 'creditcard:webhook:interim_status', orderNumber: result.orderNumber, status: result.rawStatus }));
			return json({ ok: true, message: 'Interim status acknowledged' });
		}

		// Amount validation
		if (result.amountReceived !== undefined) {
			const expectedAmount = Number(order.total ?? 0);
			if (Math.abs(result.amountReceived - expectedAmount) > 0.01) {
				console.warn(
					JSON.stringify({
						label: 'creditcard:webhook:amount_mismatch',
						orderNumber: result.orderNumber,
						expectedAmount,
						receivedAmount: result.amountReceived,
					}),
				);
				if (!validateOrderStateTransition(order.paymentStatus as OrderPaymentStatus, 'failed')) {
					return json({ ok: true, message: 'Order already processed' });
				}
				await upsertOrderInDb({
					...order,
					paymentStatus: 'failed',
					paymentFailure: {
						reason: 'amount_mismatch',
						expectedAmount,
						receivedAmount: result.amountReceived,
						updatedAt: new Date().toISOString(),
					},
				} as Record<string, unknown>);
				return json({ ok: false, error: 'Amount mismatch' }, { status: 400 });
			}
		}

		console.log(JSON.stringify({ label: 'creditcard:webhook:approved', orderNumber: result.orderNumber, amountReceived: result.amountReceived }));

		const paidAt = new Date().toISOString();

		// Gatewaylinx dry-run fulfillment mode
		if (isGatewaylinx && gatewaylinxConfig.dryRunFulfillment) {
			console.log(JSON.stringify({ label: 'creditcard:webhook:dry_run', orderNumber: result.orderNumber }));

			// Store additive dry-run audit marker in order_json
			const existingOrderJson = ((order as Record<string, unknown>).order_json as Record<string, unknown>) || {};
			const gatewaylinxAudit = {
				dryRunApprovedAt: paidAt,
				transactionId: result.transactionId,
				amountReceived: result.amountReceived,
				status: result.rawStatus || 'approved',
			};

			await upsertOrderInDb({
				...order,
				order_json: {
					...existingOrderJson,
					gatewaylinx: gatewaylinxAudit,
				},
			} as Record<string, unknown>);

			console.log(JSON.stringify({ label: 'creditcard:webhook:dry_run_audit_stored', orderNumber: result.orderNumber, audit: gatewaylinxAudit }));

			// Keep paymentStatus: "pending" - do not trigger fulfillment
			// Do not decrement stock, create Wrike tasks, or send emails
			return json({ ok: true, message: 'Dry-run: audit stored, fulfillment skipped' });
		}

		// Production mode: run full fulfillment
		let emailStatus: { sent: boolean; skipped: boolean; error?: string };
		let adminEmailStatus: { sent: boolean; skipped: boolean; error?: string };
		let fulfillmentFailed = false;
		try {
			const fulfillmentResult = await runFulfillment(order as FulfillmentOrder);
			emailStatus = fulfillmentResult.emailStatus;
			adminEmailStatus = fulfillmentResult.adminEmailStatus;
		} catch (fulfillError) {
			console.error(JSON.stringify({ label: 'creditcard:webhook:fulfillment_failed', orderNumber: result.orderNumber }));
			console.error(fulfillError);
			fulfillmentFailed = true;
			// Create retry job for later fulfillment
			try {
				await createRetryJobForOrder(result.orderNumber);
				console.log(`[creditcard:webhook] Created retry job for order ${result.orderNumber}`);
			} catch (retryError) {
				console.error(`[creditcard:webhook] Failed to create retry job for order ${result.orderNumber}`, retryError);
			}
			// Set default email status for failed fulfillment
			emailStatus = { sent: false, skipped: false, error: 'Fulfillment failed' };
			adminEmailStatus = { sent: false, skipped: false, error: 'Fulfillment failed' };
		}

		if (!emailStatus.sent) {
			console.warn(`[creditcard:webhook] Order ${result.orderNumber} customer email not sent: ${emailStatus.skipped ? 'SMTP not configured' : (emailStatus.error ?? 'unknown')}`);
		}
		if (!adminEmailStatus.sent) {
			console.warn(`[creditcard:webhook] Order ${result.orderNumber} admin email not sent: ${adminEmailStatus.skipped ? 'SMTP not configured' : (adminEmailStatus.error ?? 'unknown')}`);
		}

		// Validate state transition before marking as paid
		if (!validateOrderStateTransition(order.paymentStatus as OrderPaymentStatus, 'paid')) {
			console.warn(JSON.stringify({ label: 'creditcard:webhook:invalid_transition', orderNumber: result.orderNumber, from: order.paymentStatus, to: 'paid' }));
			return json({ ok: true, message: 'Order already processed' });
		}

		await upsertOrderInDb({
			...order,
			paymentStatus: 'paid',
			paidAt,
			fulfillmentStatus: fulfillmentFailed
				? {
						stockUpdated: false,
						emailsSent: false,
						clientSynced: false,
						failedAt: paidAt,
					}
				: {
						stockUpdated: true,
						emailsSent: Boolean(emailStatus?.sent && adminEmailStatus?.sent),
						clientSynced: (order.fulfillmentStatus as { clientSynced?: boolean } | undefined)?.clientSynced ?? false,
					},
			emailStatus,
			adminEmailStatus,
		} as Record<string, unknown>);

		console.log(JSON.stringify({ label: 'creditcard:webhook:marked_paid', orderNumber: result.orderNumber }));

		return json({ ok: true, message: 'Purchase successfully processed' });
	} catch (error) {
		console.error(JSON.stringify({ label: 'creditcard:webhook:unhandled_error' }));
		console.error(error);
		return json({ ok: false, error: 'Unable to process purchase' }, { status: 500 });
	}
}
