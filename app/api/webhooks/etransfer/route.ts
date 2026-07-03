import { NextResponse } from 'next/server';
import { getOrderByOrderNumberFromDb, hasProcessedWebhookEvent, recordWebhookEvent, upsertOrderInDb } from '@/lib/ordersDb';
import { moneyStringToCents, verifyBluepeakWebhookSignature, type BluepeakWebhookEvent } from '@/lib/bluepeak';
import { runFulfillment, type FulfillmentOrder } from '@/lib/orderFulfillment';
import { createRetryJobForOrder } from '@/lib/retryJobs';
import { validateOrderStateTransition, type OrderPaymentStatus } from '@/lib/orderComputation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PROVIDER = 'bluepeak';

function json(body: unknown, init: ResponseInit = {}) {
	return NextResponse.json(body, {
		...init,
		headers: {
			...(init.headers ?? {}),
			'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
			Pragma: 'no-cache',
			Expires: '0',
		},
	});
}

function isFresh(createdAtIso: string, maxSkewSeconds: number): boolean {
	const t = Date.parse(createdAtIso);
	if (!Number.isFinite(t)) return false;
	return Math.abs(Date.now() - t) <= maxSkewSeconds * 1000;
}

function withinTolerance(expected: string, received: string, tolerance: string): boolean {
	// tolerance is documented as 0.005, which is half-cent. Use milli-cents for exactness.
	const expMc = toMilliCents(expected);
	const recMc = toMilliCents(received);
	const tolMc = toMilliCents(tolerance);
	return Math.abs(recMc - expMc) <= tolMc;
}

function toMilliCents(value: string): number {
	const trimmed = String(value ?? '').trim();
	if (!/^[0-9]+\.[0-9]{2,3}$/.test(trimmed)) {
		// accept 2 or 3 decimal places for tolerance input like 0.005
		throw new Error(`Invalid decimal: ${trimmed}`);
	}
	const [dollars, frac] = trimmed.split('.');
	const frac3 = (frac + '000').slice(0, 3);
	return Number(dollars) * 1000 + Number(frac3);
}

export async function POST(request: Request) {
	const webhookSecret = process.env.BLUEPEAK_WEBHOOK_SECRET;
	if (!webhookSecret) {
		return json({ ok: false, error: 'Webhook not configured (missing BLUEPEAK_WEBHOOK_SECRET)' }, { status: 500 });
	}

	const dryRunFulfillment = String(process.env.BLUEPEAK_DRY_RUN_FULFILLMENT ?? '').toLowerCase() === 'true';

	try {
		const rawBody = await request.text();
		const signature = request.headers.get('signature') ?? request.headers.get('x-autodeposit-signature') ?? request.headers.get('x-adg-signature') ?? '';

		if (!verifyBluepeakWebhookSignature(rawBody, signature, webhookSecret)) {
			console.warn(JSON.stringify({ label: 'bluepeak:webhook:invalid_signature' }));
			return json({ ok: false, error: 'Invalid signature.' }, { status: 401 });
		}

		let event: BluepeakWebhookEvent;
		try {
			event = JSON.parse(rawBody) as BluepeakWebhookEvent;
		} catch {
			return json({ ok: false, error: 'Invalid JSON.' }, { status: 400 });
		}

		const eventId = String(event.event_id ?? '').trim();
		const eventType = String(event.event_type ?? '').trim();
		const createdAt = String(event.created_at ?? '').trim();
		const reference = String(event.data?.reference ?? '').trim();
		const checkoutId = String(event.data?.checkout_id ?? '').trim();
		const referenceNumber = String(event.data?.reference_number ?? '').trim();

		if (!eventId || !eventType || !createdAt || !reference || !checkoutId) {
			return json({ ok: false, error: 'Missing required fields.' }, { status: 400 });
		}

		const maxSkewSeconds = Number(process.env.BLUEPEAK_WEBHOOK_MAX_SKEW_SECONDS ?? '300');
		if (!isFresh(createdAt, Number.isFinite(maxSkewSeconds) ? maxSkewSeconds : 300)) {
			console.warn(JSON.stringify({ label: 'bluepeak:webhook:stale_event', eventId, createdAt }));
			return json({ ok: false, error: 'Stale event.' }, { status: 400 });
		}

		// Dedupe (provider guidance: dedupe on credit reference_number; fall back to event_id)
		const dedupeKey = referenceNumber || eventId;
		if (await hasProcessedWebhookEvent(PROVIDER, dedupeKey)) {
			return json({ ok: true, deduped: true });
		}

		const order = await getOrderByOrderNumberFromDb(reference);
		if (!order) {
			console.warn(JSON.stringify({ label: 'bluepeak:webhook:order_not_found', eventId, reference, referenceNumber }));
			await recordWebhookEvent({
				provider: PROVIDER,
				eventId: dedupeKey,
				orderNumber: reference,
				eventType,
				createdAt,
				receivedAt: new Date().toISOString(),
			});
			return json({ ok: true });
		}

		const existingEt = (order as Record<string, unknown>).etransfer as Record<string, unknown> | undefined;
		const existingCheckoutId = typeof existingEt?.checkoutId === 'string' ? existingEt.checkoutId : '';
		if (existingCheckoutId && existingCheckoutId !== checkoutId) {
			console.warn(JSON.stringify({ label: 'bluepeak:webhook:checkout_mismatch', eventId, reference, existingCheckoutId, checkoutId }));
		}

		const expectedAmount = String(event.data?.expected_amount ?? '').trim();
		const totalCredited = String(event.data?.total_credited ?? '').trim();
		const status = String(event.data?.status ?? '').trim();
		const overpaid = Boolean(event.data?.overpaid);
		const memoMismatch = (event.data?.memo_mismatch ?? null) as boolean | null;

		// Check current payment status BEFORE any updates
		const currentPaymentStatus = String((order as Record<string, unknown>).paymentStatus ?? '');
		if (currentPaymentStatus === 'paid') {
			// Record event for deduplication, then return
			await recordWebhookEvent({
				provider: PROVIDER,
				eventId: dedupeKey,
				orderNumber: reference,
				eventType,
				createdAt,
				receivedAt: new Date().toISOString(),
			});
			return json({ ok: true, alreadyPaid: true });
		}

		// Only payment.completed can transition to paid.
		if (eventType !== 'payment.completed') {
			// Update etransfer data for non-completed events
			const updatedBase = {
				...(order as Record<string, unknown>),
				paymentProvider: 'bluepeak',
				etransfer: {
					...(existingEt ?? {}),
					provider: 'bluepeak',
					status,
					checkoutId,
					currency: 'CAD',
					amountExpected: expectedAmount,
					amountReceived: totalCredited,
					paymentReference: reference,
					overpaid,
					memoMismatch,
					lastEventId: eventId,
					lastReferenceNumber: referenceNumber || null,
					lastEventAt: createdAt,
					paidAt: (existingEt as { paidAt?: string | null } | undefined)?.paidAt ?? null,
				},
			};
			await upsertOrderInDb(updatedBase);
			await recordWebhookEvent({
				provider: PROVIDER,
				eventId: dedupeKey,
				orderNumber: reference,
				eventType,
				createdAt,
				receivedAt: new Date().toISOString(),
			});
			return json({ ok: true });
		}

		// Validate state transition before proceeding
		// Re-fetch and use this as the authoritative base for subsequent writes (prevents overwriting terminal states)
		const freshOrder = await getOrderByOrderNumberFromDb(reference);
		if (!freshOrder) {
			console.warn(JSON.stringify({ label: 'bluepeak:webhook:order_not_found_before_transition', eventId, reference }));
			return json({ ok: true });
		}

		if (!validateOrderStateTransition(freshOrder.paymentStatus as OrderPaymentStatus, 'paid')) {
			console.warn(JSON.stringify({ label: 'bluepeak:webhook:invalid_transition', eventId, reference, from: freshOrder.paymentStatus, to: 'paid' }));
			// Record event to prevent retries, but don't update payment status
			await recordWebhookEvent({
				provider: PROVIDER,
				eventId: dedupeKey,
				orderNumber: reference,
				eventType,
				createdAt,
				receivedAt: new Date().toISOString(),
			});
			return json({ ok: true, alreadyProcessed: true });
		}

		// Update etransfer data before proceeding with payment completion
		const updatedBase = {
			...(freshOrder as Record<string, unknown>),
			paymentProvider: 'bluepeak',
			etransfer: {
				...(existingEt ?? {}),
				provider: 'bluepeak',
				status,
				checkoutId,
				currency: 'CAD',
				amountExpected: expectedAmount,
				amountReceived: totalCredited,
				paymentReference: reference,
				overpaid,
				memoMismatch,
				lastEventId: eventId,
				lastReferenceNumber: referenceNumber || null,
				lastEventAt: createdAt,
				paidAt: (existingEt as { paidAt?: string | null } | undefined)?.paidAt ?? null,
			},
		};

		await upsertOrderInDb(updatedBase);

		// Record event for deduplication
		await recordWebhookEvent({
			provider: PROVIDER,
			eventId: dedupeKey,
			orderNumber: reference,
			eventType,
			createdAt,
			receivedAt: new Date().toISOString(),
		});

		// Deterministic amount checks: never compare floats
		let amountOk = false;
		try {
			// Ensure inputs are valid money strings (throws if invalid)
			moneyStringToCents(expectedAmount);
			moneyStringToCents(totalCredited);
			amountOk = withinTolerance(expectedAmount, totalCredited, '0.005');
		} catch (err) {
			console.warn(
				JSON.stringify({
					label: 'bluepeak:webhook:amount_parse_error',
					eventId,
					reference,
					expectedAmount,
					totalCredited,
				}),
			);
			amountOk = false;
		}

		if (!amountOk || overpaid) {
			console.warn(
				JSON.stringify({
					label: 'bluepeak:webhook:amount_mismatch',
					eventId,
					reference,
					expectedAmount,
					totalCredited,
					overpaid,
					status,
				}),
			);
			// Keep pending; manual review.
			return json({ ok: true, flagged: true });
		}

		if (memoMismatch === true) {
			console.warn(
				JSON.stringify({
					label: 'bluepeak:webhook:memo_mismatch',
					eventId,
					reference,
					status,
				}),
			);
			// Keep pending; manual review.
			return json({ ok: true, flagged: true, memoMismatch: true });
		}

		const paidAt = new Date().toISOString();

		// Final guard: re-fetch and validate transition immediately before marking as paid
		const orderBeforePaid = await getOrderByOrderNumberFromDb(reference);
		if (!orderBeforePaid) {
			console.warn(JSON.stringify({ label: 'bluepeak:webhook:order_not_found_before_mark_paid', eventId, reference }));
			return json({ ok: true });
		}

		if (String((orderBeforePaid as Record<string, unknown>).paymentStatus ?? '') === 'paid') {
			return json({ ok: true, alreadyPaid: true });
		}

		if (!validateOrderStateTransition(orderBeforePaid.paymentStatus as OrderPaymentStatus, 'paid')) {
			console.warn(
				JSON.stringify({
					label: 'bluepeak:webhook:invalid_transition_before_mark_paid',
					eventId,
					reference,
					from: orderBeforePaid.paymentStatus,
					to: 'paid',
				}),
			);
			return json({ ok: true, alreadyProcessed: true });
		}

		const existingFulfillmentStatus = (orderBeforePaid as Record<string, unknown>).fulfillmentStatus as Record<string, unknown> | undefined;
		const alreadyFulfilled = Boolean(existingFulfillmentStatus && existingFulfillmentStatus.stockUpdated === true);
		const existingEmailStatus = (orderBeforePaid as Record<string, unknown>).emailStatus;
		const existingAdminEmailStatus = (orderBeforePaid as Record<string, unknown>).adminEmailStatus;

		// Mark paid and respond quickly so the provider doesn't time out.
		await upsertOrderInDb({
			...(updatedBase as Record<string, unknown>),
			paymentStatus: 'paid',
			paidAt,
			etransfer: {
				...((updatedBase as Record<string, unknown>).etransfer as Record<string, unknown>),
				paidAt,
			},
			// Preserve existing fulfillment statuses if present; otherwise initialize as pending.
			fulfillmentStatus: existingFulfillmentStatus ?? {
				stockUpdated: false,
				emailsSent: false,
				clientSynced: false,
			},
			emailStatus: existingEmailStatus,
			adminEmailStatus: existingAdminEmailStatus,
		});

		if (dryRunFulfillment) {
			console.warn(JSON.stringify({ label: 'bluepeak:webhook:dry_run_fulfillment', eventId, reference }));
			return json({ ok: true, dryRun: true });
		}

		if (!alreadyFulfilled) {
			void (async () => {
				let fulfillmentFailed = false;
				let emailStatus: unknown;
				let adminEmailStatus: unknown;
				try {
					const latest = await getOrderByOrderNumberFromDb(reference);
					if (!latest) return;
					const latestFulfillmentStatus = (latest as Record<string, unknown>).fulfillmentStatus as Record<string, unknown> | undefined;
					if (latestFulfillmentStatus && latestFulfillmentStatus.stockUpdated === true) return;

					const result = await runFulfillment(latest as unknown as FulfillmentOrder, { paymentConfirmed: true });
					emailStatus = result.emailStatus;
					adminEmailStatus = result.adminEmailStatus;
				} catch (fulfillError) {
					console.error(JSON.stringify({ label: 'bluepeak:webhook:fulfillment_failed', eventId, reference }));
					console.error(fulfillError);
					fulfillmentFailed = true;
					try {
						await createRetryJobForOrder(reference);
					} catch (retryError) {
						console.error(JSON.stringify({ label: 'bluepeak:webhook:retry_job_failed', reference }));
						console.error(retryError);
					}
				}

				try {
					const latestAfter = await getOrderByOrderNumberFromDb(reference);
					if (!latestAfter) return;
					await upsertOrderInDb({
						...(latestAfter as Record<string, unknown>),
						fulfillmentStatus: fulfillmentFailed
							? {
									stockUpdated: false,
									emailsSent: false,
									clientSynced: false,
									failedAt: new Date().toISOString(),
								}
							: {
									stockUpdated: true,
									emailsSent: Boolean((emailStatus as { sent?: boolean } | undefined)?.sent && (adminEmailStatus as { sent?: boolean } | undefined)?.sent),
									clientSynced: (latestAfter.fulfillmentStatus as { clientSynced?: boolean } | undefined)?.clientSynced ?? false,
								},
						emailStatus: fulfillmentFailed ? (latestAfter as Record<string, unknown>).emailStatus : emailStatus,
						adminEmailStatus: fulfillmentFailed ? (latestAfter as Record<string, unknown>).adminEmailStatus : adminEmailStatus,
					});
				} catch (persistErr) {
					console.error(JSON.stringify({ label: 'bluepeak:webhook:fulfillment_persist_failed', reference }));
					console.error(persistErr);
				}
			})();
		}

		return json({ ok: true });
	} catch (error) {
		console.error(JSON.stringify({ label: 'bluepeak:webhook:unhandled_error' }));
		console.error(error);
		// Return non-2xx to trigger provider retry
		return json({ ok: false, error: 'Unable to process webhook.' }, { status: 500 });
	}
}
