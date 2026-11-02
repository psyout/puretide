import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ROUTES = Object.freeze({ resolve: '/order-attribution/v1/resolve', snapshots: '/order-attribution/v1/snapshots' });
export const VISIT = /^[A-Za-z0-9_-]{1,128}$/;
export const HEX = /^[a-f0-9]{64}$/;
export const MAX_REVISION = 2147483647;

export class AttributionError extends Error {
  constructor(code, retryable = false) {
    super(code);
    this.name = 'AttributionError';
    this.code = code;
    this.retryable = retryable;
  }
}
export function fail(code, retryable = false) { throw new AttributionError(code, retryable); }
export function exactKeys(value, names) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value,name));
}
export function hmac(secret, input) { return createHmac('sha256', Buffer.from(secret, 'hex')).update(input).digest('hex'); }
export function equalHex(left, right) {
  return HEX.test(left) && HEX.test(right) && timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
export function requireSecret(value, name) {
  if (typeof value !== 'string' || !HEX.test(value)) fail(`INVALID_${name}`);
  return value;
}
export function localReference(secret, domain, identifier) {
  if (typeof identifier !== 'string' || identifier.length === 0 || Buffer.byteLength(identifier) > 1024) fail('INVALID_LOCAL_IDENTIFIER');
  return hmac(secret, `order-attribution/v1/${domain}\0${identifier}`);
}

/** Pure wire signer. Fixture values are accepted here for deterministic tests only. */
export function signRequest({ logicalRoute, rawBody, keyId, secret, timestamp, nonce }) {
  if (!Object.values(ROUTES).includes(logicalRoute)) fail('INVALID_ROUTE');
  if (typeof rawBody !== 'string' || Buffer.byteLength(rawBody) > 4096) fail('INVALID_BODY');
  if (typeof keyId !== 'string' || !/^[A-Za-z0-9_-]{1,48}$/.test(keyId)) fail('INVALID_KEY_ID');
  requireSecret(secret, 'COLLECTOR_SECRET');
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{32}$/.test(nonce)) fail('INVALID_SIGNING_INPUT');
  const digest = createHash('sha256').update(rawBody).digest('hex');
  const signature = hmac(secret, `1\nPOST\n${logicalRoute}\n${timestamp}\n${nonce}\n${digest}`);
  return Object.freeze({
    'Content-Type': 'application/json',
    'X-Attribution-Key-Id': keyId,
    'X-Attribution-Timestamp': timestamp,
    'X-Attribution-Nonce': nonce,
    'X-Attribution-Signature': signature,
  });
}

async function readJson(response) {
  if (!response.body || typeof response.body.getReader !== 'function') fail('COLLECTOR_RESPONSE', true);
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) { await reader.cancel(); fail('COLLECTOR_RESPONSE', true); }
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof AttributionError) throw error;
    fail('COLLECTOR_RESPONSE', true);
  } finally { reader.releaseLock(); }
}

export function createTransport({ collectorBaseUrl, keyId, collectorSecret, timeoutMs, fetchImpl, now }) {
  let base;
  try { base = new URL(collectorBaseUrl); } catch { fail('INVALID_COLLECTOR_URL'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) fail('INVALID_COLLECTOR_URL');
  if (!base.pathname.endsWith('/order-attribution/v1')) fail('INVALID_COLLECTOR_PATH');
  const endpoint = base.href;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) fail('INVALID_TIMEOUT');
  return async function post(kind, body) {
    const rawBody = JSON.stringify(body);
    const headers = signRequest({
      logicalRoute: ROUTES[kind], rawBody, keyId, secret: collectorSecret,
      timestamp: String(now()), nonce: randomBytes(16).toString('hex'),
    });
    let response;
    try {
      response = await fetchImpl(`${endpoint}/${kind}`, {
        method: 'POST', headers, body: rawBody, redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs), credentials: 'omit', cache: 'no-store',
      });
    } catch { fail('COLLECTOR_UNAVAILABLE', true); }
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => {});
      fail(response.status === 409 ? 'COLLECTOR_CONFLICT' : 'COLLECTOR_UNAVAILABLE', true);
    }
    return readJson(response);
  };
}
