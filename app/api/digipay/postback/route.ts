import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildOrderEmails } from '@/lib/orderEmail';
import { readSheetProducts, writeSheetProducts, upsertSheetClient } from '@/lib/stockSheet';
import { sendMail, sendLowStockAlert } from '@/lib/email';
import { LOW_STOCK_THRESHOLD, DEFAULT_ORDER_NOTIFICATION_EMAIL } from '@/lib/constants';
import {
  type RetryJob,
  getOrderBySessionFromDb,
  getRetryJobBySessionFromDb,
  listDuePendingRetryJobsFromDb,
  upsertOrderInDb,
  upsertRetryJobInDb,
} from '@/lib/ordersDb';

const DIGIPAY_ALLOWED_IP = '185.240.29.227';
const MAX_RETRY_ATTEMPTS = 6;
const RETRY_BASE_DELAY_SECONDS = 30;
let hasWarnedMissingHmacSecret = false;

function xmlResponse(stat: 'ok' | 'fail', code: number, message: string, receipt?: string) {
  const body = stat === 'ok'
    ? `<?xml version="1.0" encoding="UTF-8"?>\n<rsp stat="ok" version="1.0">\n<message id="${code}">${escapeXml(message)}</message>\n${receipt ? `<receipt>${escapeXml(receipt)}</receipt>\n` : ''}</rsp>`
    : `<?xml version="1.0" encoding="UTF-8"?>\n<rsp stat="fail" version="1.0">\n<error id="${code}">${escapeXml(message)}</error>\n</rsp>`;
  return new NextResponse(body, { status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function parsePostbackBody(rawBody: string): Record<string, unknown> {
  if (rawBody.startsWith('{')) return JSON.parse(rawBody) as Record<string, unknown>;
  const params = new URLSearchParams(rawBody);
  for (const [key, value] of Array.from(params.entries())) {
    const raw = key.startsWith('{') ? key : value;
    if (!raw.startsWith('{')) continue;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // try next entry
    }
  }
  return {};
}

function verifyHmacSignature(rawBody: string, request: Request): { ok: true } | { ok: false; message: string } {
  const secret = process.env.DIGIPAY_POSTBACK_HMAC_SECRET;
  if (!secret) {
    if (!hasWarnedMissingHmacSecret) {
      console.warn('DIGIPAY_POSTBACK_HMAC_SECRET not configured. Skipping HMAC verification for DigiPay postback.');
      hasWarnedMissingHmacSecret = true;
    }
    return { ok: true };
  }

  const provided = request.headers.get('x-digipay-signature') ?? request.headers.get('x-signature') ?? request.headers.get('digipay-signature') ?? '';
  if (!provided) return { ok: false, message: 'Missing signature header' };

  const normalized = provided.replace(/^sha256=/i, '').trim();
  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const expectedBase64 = Buffer.from(expectedHex, 'hex').toString('base64');
  if (normalized.length === expectedHex.length && crypto.timingSafeEqual(Buffer.from(normalized), Buffer.from(expectedHex))) return { ok: true };
  if (normalized.length === expectedBase64.length && crypto.timingSafeEqual(Buffer.from(normalized), Buffer.from(expectedBase64))) return { ok: true };
  return { ok: false, message: 'Invalid signature' };
}

function getBackoffSeconds(attempts: number): number {
  return Math.min(60 * 60, RETRY_BASE_DELAY_SECONDS * 2 ** Math.max(0, attempts - 1));
}

async function updateSheetStock(items: Array<{ id: number; name: string; price: number; quantity: number }>): Promise<void> {
  const current = await readSheetProducts();
  const updated = current.map((product) => {
    const match = items.find((item) => String(item.id) === product.id || String(item.id) === product.slug);
    if (!match) return product;
    return { ...product, stock: Math.max(0, product.stock - match.quantity) };
  });
  const lowStock = updated.filter((product) => product.stock <= LOW_STOCK_THRESHOLD);
  await writeSheetProducts(updated);
  await sendLowStockAlert(lowStock);
}

async function runFulfillmentForSession(session: string) {
  const order = getOrderBySessionFromDb(session) as Record<string, any> | null;
  if (!order) throw new Error(`Order not found for session ${session}`);

  const customer = order.customer as Parameters<typeof buildOrderEmails>[0]['customer'];
  const cartItems = (order.cartItems ?? []) as Array<{ id: number; name: string; price: number; quantity: number }>;
  const fulfillmentStatus = (order.fulfillmentStatus ?? { stockUpdated: false, emailsSent: false, clientSynced: false }) as {
    stockUpdated: boolean;
    emailsSent: boolean;
    clientSynced: boolean;
    updatedAt?: string;
  };

  if (!fulfillmentStatus.stockUpdated) {
    await updateSheetStock(cartItems);
    fulfillmentStatus.stockUpdated = true;
    fulfillmentStatus.updatedAt = new Date().toISOString();
    upsertOrderInDb({ ...order, fulfillmentStatus });
  }

  if (!fulfillmentStatus.emailsSent) {
    const emailData = buildOrderEmails({
      orderNumber: String(order.orderNumber ?? session),
      createdAt: String(order.createdAt ?? ''),
      customer,
      shipToDifferentAddress: Boolean(order.shipToDifferentAddress),
      shippingAddress: order.shippingAddress,
      shippingMethod: 'express',
      subtotal: Number(order.subtotal),
      shippingCost: Number(order.shippingCost),
      discountAmount: order.discountAmount != null ? Number(order.discountAmount) : undefined,
      promoCode: order.promoCode,
      total: Number(order.total ?? 0),
      cartItems,
    });

    const customerReplyTo = `${customer.firstName} ${customer.lastName} <${customer.email}>`;
    const adminRecipient = process.env.ORDER_NOTIFICATION_EMAIL ?? DEFAULT_ORDER_NOTIFICATION_EMAIL;
    const emailStatus = await sendMail({ to: customer.email, subject: emailData.customer.subject, text: emailData.customer.text, html: emailData.customer.html, replyTo: customerReplyTo });
    const adminEmailStatus = await sendMail({ to: adminRecipient, subject: emailData.admin.subject, text: emailData.admin.text, html: emailData.admin.html, replyTo: customerReplyTo });

    if (!emailStatus.sent || !adminEmailStatus.sent) {
      throw new Error(`Email send failed. customer=${emailStatus.error ?? 'unknown'} admin=${adminEmailStatus.error ?? 'unknown'}`);
    }

    fulfillmentStatus.emailsSent = true;
    fulfillmentStatus.updatedAt = new Date().toISOString();
    upsertOrderInDb({
      ...order,
      emailStatus: { sent: emailStatus.sent, skipped: false, error: emailStatus.error },
      adminEmailStatus: { sent: adminEmailStatus.sent, skipped: false, error: adminEmailStatus.error },
      fulfillmentStatus,
    });
  }

  if (!fulfillmentStatus.clientSynced) {
    await upsertSheetClient({
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      address: customer.address,
      city: customer.city,
      province: customer.province,
      zipCode: customer.zipCode,
      country: customer.country,
      orderTotal: Number(order.total ?? 0),
      lastOrderDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      productsPurchased: cartItems.map((item) => item.name),
    });
    fulfillmentStatus.clientSynced = true;
    fulfillmentStatus.updatedAt = new Date().toISOString();
    upsertOrderInDb({ ...order, fulfillmentStatus });
  }
}

function enqueueRetry(session: string, message: string) {
  const now = new Date().toISOString();
  const existing = getRetryJobBySessionFromDb(session);
  const job: RetryJob = existing && existing.status === 'pending'
    ? { ...existing, lastError: message, updatedAt: now }
    : {
        id: existing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        session,
        attempts: 0,
        nextRunAt: new Date(Date.now() + RETRY_BASE_DELAY_SECONDS * 1000).toISOString(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lastError: message,
        status: 'pending',
      };
  upsertRetryJobInDb(job);
}

async function processRetryQueue() {
  const nowIso = new Date().toISOString();
  for (const job of listDuePendingRetryJobsFromDb(nowIso)) {
    try {
      await runFulfillmentForSession(job.session);
      upsertRetryJobInDb({ ...job, status: 'completed', updatedAt: nowIso });
    } catch (error) {
      const attempts = job.attempts + 1;
      const failed = attempts >= MAX_RETRY_ATTEMPTS;
      upsertRetryJobInDb({
        ...job,
        attempts,
        updatedAt: nowIso,
        lastError: error instanceof Error ? error.message : 'Unknown retry error',
        status: failed ? 'failed' : 'pending',
        nextRunAt: failed ? job.nextRunAt : new Date(Date.now() + getBackoffSeconds(attempts) * 1000).toISOString(),
      });
    }
  }
}

function queueFulfillmentAndProcessNow(session: string) {
  enqueueRetry(session, 'Postback accepted. Fulfillment queued.');
  // Do not delay DigiPay acknowledgement; process queued work opportunistically.
  void processRetryQueue().catch((error) => {
    console.error('Failed processing fulfillment retry queue after postback ack', error);
  });
}

export async function POST(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const clientIp = forwarded?.split(',')[0].trim() || request.headers.get('x-real-ip') || '';
  if (clientIp !== DIGIPAY_ALLOWED_IP) return xmlResponse('fail', 101, `Request from unauthorized IP: ${clientIp}`);

  const rawBody = await request.text();
  const hmac = verifyHmacSignature(rawBody, request);
  if (!hmac.ok) return xmlResponse('fail', 103, hmac.message);

  const data = parsePostbackBody(rawBody);
  if (Object.keys(data).length === 0) return xmlResponse('fail', 102, 'Invalid postback body');

  const session = typeof data.session === 'string' ? data.session.trim() : '';
  if (!session) return xmlResponse('fail', 102, "Invalid session variable: 'empty'");

  await processRetryQueue();

  const order = getOrderBySessionFromDb(session) as Record<string, any> | null;
  if (!order) return xmlResponse('fail', 102, `Invalid session variable: '${session}'`);
  if (order.paymentStatus === 'paid') return xmlResponse('ok', 100, 'Order already processed', session);

  const rawAmount = typeof data.amount === 'string' ? data.amount.trim() : '';
  const paidAmount = Number(rawAmount.replace('_', '.'));
  const expectedAmount = Number(order.total ?? 0);
  if (!rawAmount || Number.isNaN(paidAmount)) return xmlResponse('fail', 102, 'Invalid amount format');
  if (Math.abs(paidAmount - expectedAmount) > 0.01) return xmlResponse('fail', 104, `Amount mismatch. Expected ${expectedAmount}, received ${paidAmount}`);

  upsertOrderInDb({
    ...order,
    paymentStatus: 'paid',
    paidAt: new Date().toISOString(),
    fulfillmentStatus: order.fulfillmentStatus ?? { stockUpdated: false, emailsSent: false, clientSynced: false },
  });

  queueFulfillmentAndProcessNow(session);
  return xmlResponse('ok', 100, 'Purchase successfully processed', session);
}
