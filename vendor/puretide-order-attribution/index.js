import { AttributionError, createTransport, equalHex, exactKeys, fail, hmac, localReference, requireSecret, VISIT, MAX_REVISION } from './protocol.js';
export { signRequest, AttributionError } from './protocol.js';

const ATTRIBUTION_FIELDS = ['version','environment','visit_id','consent_policy','captured_at','expires_at','proof'];
const COOKIE_FIELDS = ['v','e','p','id','iat','exp'];

function resultError(error) {
  return { ok: false, status: 'error', error: {
    code: error instanceof AttributionError ? error.code : 'TRACKING_UNAVAILABLE',
    retryable: error instanceof AttributionError ? error.retryable : true,
  } };
}
/** All methods run on the merchant server. Never import this module into a browser bundle. */
export function createAttributionIntegration(options) {
  if (typeof window !== 'undefined') fail('SERVER_ONLY');
  const {
    environment, consentPolicy, retentionSeconds, keyId, collectorSecret, cookieSecret,
    orderReferenceSecret, repository, analyticsConsent, loadOrder, verifyPayment,
    collectorBaseUrl = 'https://pure-deals.com/wp-json/order-attribution/v1',
    storeOrigin = 'https://puretide.ca',
    publicQueryParameter = 'visit_id', cookieName = '__Host-order_attribution',
    enabled = false, productionEnabled = false, timeoutMs = 5000,
    fetchImpl = globalThis.fetch, now = () => Math.floor(Date.now() / 1000),
  } = options ?? {};
  if (!['qa','production'].includes(environment)) fail('INVALID_ENVIRONMENT');
  if (typeof enabled !== 'boolean' || typeof productionEnabled !== 'boolean') fail('INVALID_ENABLE_FLAGS');
  if (typeof consentPolicy !== 'string' || !/^[\x21-\x7e]{1,64}$/.test(consentPolicy)) fail('INVALID_CONSENT_POLICY');
  if (!Number.isInteger(retentionSeconds) || retentionSeconds < 1 || retentionSeconds > 31536000) fail('INVALID_RETENTION');
  if (typeof keyId !== 'string' || !/^[A-Za-z0-9_-]{1,48}$/.test(keyId)) fail('INVALID_KEY_ID');
  requireSecret(collectorSecret, 'COLLECTOR_SECRET');
  requireSecret(cookieSecret, 'COOKIE_SECRET');
  requireSecret(orderReferenceSecret, 'ORDER_REFERENCE_SECRET');
  if (new Set([collectorSecret,cookieSecret,orderReferenceSecret]).size !== 3) fail('SEPARATE_SECRETS_REQUIRED');
  for (const [name, adapter] of Object.entries({ analyticsConsent,loadOrder,verifyPayment })) {
    if (typeof adapter !== 'function') fail(`MISSING_${name.toUpperCase()}_ADAPTER`);
  }
  for (const method of ['enqueue','claimNext','complete','retry','cancel','revoke']) {
    if (typeof repository?.[method] !== 'function') fail('DURABLE_REPOSITORY_REQUIRED');
  }
  if (typeof fetchImpl !== 'function' || typeof now !== 'function') fail('INVALID_RUNTIME_ADAPTER');
  if (typeof publicQueryParameter !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,47}$/.test(publicQueryParameter)) fail('INVALID_PUBLIC_PARAMETER');
  if (typeof cookieName !== 'string' || !/^__Host-[A-Za-z0-9_-]{1,48}$/.test(cookieName)) fail('INVALID_COOKIE_NAME');
  let merchant;
  try { merchant = new URL(storeOrigin); } catch { fail('INVALID_STORE_ORIGIN'); }
  if (merchant.protocol !== 'https:' || merchant.origin !== storeOrigin || merchant.username || merchant.password) fail('INVALID_STORE_ORIGIN');
  const post = createTransport({ collectorBaseUrl,keyId,collectorSecret,timeoutMs,fetchImpl,now });
  const active = enabled && (environment !== 'production' || productionEnabled);
  const cookieAttributes = 'Path=/; Secure; HttpOnly; SameSite=Lax';
  const clearCookie = `${cookieName}=; ${cookieAttributes}; Max-Age=0`;
  const disabled = () => ({ ok: true, status: 'disabled', setCookie: clearCookie });
  const reference = orderId => localReference(orderReferenceSecret, `order-ref/${environment}`, orderId);
  const signedAttribution = token => {
    if (typeof token !== 'string' || token.length > 1024) fail('INVALID_ATTRIBUTION');
    const parts = token.split('.');
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !equalHex(hmac(cookieSecret, `order-attribution/v1/cookie\0${parts[0]}`), parts[1])) fail('INVALID_ATTRIBUTION');
    let data;
    try {
      const decoded = Buffer.from(parts[0], 'base64url');
      if (decoded.toString('base64url') !== parts[0]) fail('INVALID_ATTRIBUTION');
      data = JSON.parse(decoded.toString('utf8'));
    } catch { fail('INVALID_ATTRIBUTION'); }
    if (!exactKeys(data,COOKIE_FIELDS) || data.v !== 1 || data.e !== environment || data.p !== consentPolicy
      || typeof data.id !== 'string' || !VISIT.test(data.id) || !Number.isSafeInteger(data.iat) || !Number.isSafeInteger(data.exp)
      || data.iat < 0 || data.iat > now() || data.exp - data.iat !== retentionSeconds) fail('INVALID_ATTRIBUTION');
    return Object.freeze({ version:1,environment,visit_id:data.id,consent_policy:data.p,captured_at:data.iat,expires_at:data.exp,proof:token });
  };
  const currentConsent = async context => {
    try { return (await analyticsConsent(context)) === true; }
    catch { fail('CONSENT_UNAVAILABLE', true); }
  };
  const savedOrder = async lookup => {
    let order;
    try { order = await loadOrder(Object.freeze(lookup)); }
    catch { fail('ORDER_LOAD_FAILED', true); }
    if (!order || order.committed !== true) fail('ORDER_NOT_COMMITTED', true);
    if (typeof order.id !== 'string' || (lookup.orderId !== undefined && lookup.orderId !== order.id)) fail('ORDER_LOOKUP_MISMATCH', true);
    const orderRef = reference(order.id);
    if (lookup.orderRef !== undefined && lookup.orderRef !== orderRef) fail('ORDER_LOOKUP_MISMATCH', true);
    if (order.analyticsAllowed === false) return { refused:true,orderRef };
    if (order.analyticsAllowed !== true) fail('CONSENT_STATE_UNAVAILABLE', true);
    if (!Number.isSafeInteger(order.createdAt) || order.createdAt < 0 || order.createdAt > now()+300) fail('ORDER_CREATED_AT_UNAVAILABLE', true);
    if (order.attribution === undefined) fail('ORDER_ATTRIBUTION_UNAVAILABLE', true);
    if (order.attribution === null) return { refused:false,unattributed:true,orderRef };
    if (!exactKeys(order.attribution,ATTRIBUTION_FIELDS)) fail('ORDER_ATTRIBUTION_UNVERIFIABLE', true);
    let attribution;
    try { attribution = signedAttribution(order.attribution.proof); }
    catch { fail('ORDER_ATTRIBUTION_UNVERIFIABLE', true); }
    if (ATTRIBUTION_FIELDS.some(key => order.attribution[key] !== attribution[key])) fail('ORDER_ATTRIBUTION_CHANGED', true);
    if (order.createdAt < attribution.captured_at || order.createdAt >= attribution.expires_at) fail('ORDER_OUTSIDE_ATTRIBUTION_WINDOW', true);
    return { refused:false,orderRef,attribution };
  };
  const record = async (orderId, paid, eventRef = null) => {
    reference(orderId); // Validate the requested ID before invoking a merchant lookup adapter.
    const order = await savedOrder({ orderId });
    if (order.refused) {
      await repository.revoke({ orderRef:order.orderRef });
      return { ok:true,status:'refused' };
    }
    if (order.unattributed) return { ok:true,status:'unattributed' };
    const queued = await repository.enqueue({ orderRef:order.orderRef,environment,visitId:order.attribution.visit_id,
      consentPolicy:order.attribution.consent_policy,paid,eventRef,now:now() });
    return { ok:true,status:queued.status,order_ref:order.orderRef,revision:queued.revision };
  };

  return Object.freeze({
    /** Persist this opaque lookup beside the business order so background flushes can reload it. */
    orderReference: reference,
    clearCookie,
    async captureVisit({ requestUrl,context } = {}) {
      if (!active) return disabled();
      try {
        if (!await currentConsent(context)) return { ok:true,status:'refused',setCookie:clearCookie };
        let url;
        try { url = new URL(requestUrl); } catch { fail('INVALID_REQUEST_URL'); }
        if (url.protocol !== 'https:' || url.origin !== merchant.origin || url.username || url.password) fail('INVALID_REQUEST_URL');
        const values = url.searchParams.getAll(publicQueryParameter);
        if (values.length === 0) return { ok:true,status:'no_candidate',setCookie:null };
        if (values.length !== 1 || !VISIT.test(values[0])) return { ok:true,status:'ineligible',setCookie:clearCookie };
        const visitId = values[0];
        const response = await post('resolve',{ version:1,store:'puretide',environment,visit_id:visitId,analytics:true,consent_policy:consentPolicy });
        if (!exactKeys(response,['version','environment','eligible','visit_id']) || response.version !== 1
          || response.environment !== environment || response.visit_id !== visitId || typeof response.eligible !== 'boolean') fail('COLLECTOR_RESPONSE', true);
        if (!response.eligible) return { ok:true,status:'ineligible',setCookie:clearCookie };
        const issued = now();
        const payload = Buffer.from(JSON.stringify({ v:1,e:environment,p:consentPolicy,id:visitId,iat:issued,exp:issued+retentionSeconds })).toString('base64url');
        const token = `${payload}.${hmac(cookieSecret, `order-attribution/v1/cookie\0${payload}`)}`;
        return { ok:true,status:'captured',setCookie:`${cookieName}=${token}; ${cookieAttributes}; Max-Age=${retentionSeconds}` };
      } catch (error) { return { ...resultError(error),setCookie:clearCookie }; }
    },
    async extractOrderAttribution({ cookieHeader,context } = {}) {
      if (!active) return { ...disabled(),attribution:null };
      try {
        if (!await currentConsent(context)) return { ok:true,status:'refused',attribution:null,setCookie:clearCookie };
        if (typeof cookieHeader !== 'string' || cookieHeader.length > 65536) return { ok:true,status:'missing',attribution:null,setCookie:clearCookie };
        const matches = cookieHeader.split(';').map(part => part.trim()).filter(part => part.startsWith(`${cookieName}=`));
        if (matches.length !== 1) return { ok:true,status:'invalid',attribution:null,setCookie:clearCookie };
        let attribution;
        try { attribution = signedAttribution(matches[0].slice(cookieName.length+1)); }
        catch { return { ok:true,status:'invalid',attribution:null,setCookie:clearCookie }; }
        if (now() >= attribution.expires_at) return { ok:true,status:'expired',attribution:null,setCookie:clearCookie };
        return { ok:true,status:'eligible',attribution,setCookie:null };
      } catch (error) { return { ...resultError(error),attribution:null,setCookie:clearCookie }; }
    },
    async recordOrderPlaced(orderId) {
      if (!active) return disabled();
      try { return await record(orderId,false); }
      catch (error) { return resultError(error); }
    },
    /**
     * Merchant hook for payment flows that already verified the provider,
     * merchant account, order, amount, currency, and full settlement.
     */
    async recordVerifiedPaid({ orderId,provider,eventId } = {}) {
      if (!active) return disabled();
      try {
        if (typeof provider !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(provider)) fail('INVALID_VERIFIED_PAYMENT');
        reference(orderId);
        const eventRef = localReference(orderReferenceSecret,`provider-event/${environment}/${provider}`,eventId);
        return await record(orderId,true,eventRef);
      } catch (error) { return resultError(error); }
    },
    async handlePaymentWebhook(rawBody, headers) {
      if (!active) return disabled();
      try {
        if (!(Buffer.isBuffer(rawBody) || rawBody instanceof Uint8Array) || rawBody.byteLength > 1048576) fail('RAW_PAYMENT_BODY_REQUIRED');
        let payment;
        try { payment = await verifyPayment(rawBody,headers); }
        catch { fail('PAYMENT_VERIFICATION_FAILED'); }
        if (payment?.verified !== true || typeof payment.settled !== 'boolean') fail('PAYMENT_UNVERIFIED');
        if (!payment.settled) return { ok:true,status:'not_settled' };
        if (typeof payment.provider !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(payment.provider)) fail('INVALID_VERIFIED_PAYMENT');
        reference(payment.orderId);
        const eventRef = localReference(orderReferenceSecret,`provider-event/${environment}/${payment.provider}`,payment.eventId);
        return await record(payment.orderId,true,eventRef);
      } catch (error) { return resultError(error); }
    },
    async flush({ limit = 20 } = {}) {
      if (!active) return { ok:true,status:'disabled',delivered:0,retried:0,cancelled:0 };
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) return resultError(new AttributionError('INVALID_FLUSH_LIMIT'));
      const counts = { delivered:0,retried:0,cancelled:0 };
      try {
        for (let index=0;index<limit;index++) {
          const snapshot = await repository.claimNext({ environment,now:now(),leaseSeconds:Math.ceil(timeoutMs/1000)+30 });
          if (!snapshot) break;
          const lease = { orderRef:snapshot.orderRef,revision:snapshot.revision,leaseToken:snapshot.leaseToken };
          try {
            if (snapshot.environment !== environment) fail('REPOSITORY_ENVIRONMENT_MISMATCH', true);
            const order = await savedOrder({ orderRef:snapshot.orderRef });
            if (order.refused) {
              await repository.cancel(lease); counts.cancelled++; continue;
            }
            if (order.unattributed || order.attribution.visit_id !== snapshot.visitId || order.attribution.consent_policy !== snapshot.consentPolicy) fail('ORDER_ATTRIBUTION_CHANGED', true);
            const body = { version:1,store:'puretide',environment,order_ref:snapshot.orderRef,revision:snapshot.revision,
              visit_id:snapshot.visitId,placed:true,paid:snapshot.paid,analytics:true,consent_policy:snapshot.consentPolicy };
            const ack = await post('snapshots',body);
            if (!exactKeys(ack,['version','environment','order_ref','accepted_revision','status']) || ack.version !== 1
              || ack.environment !== environment || ack.order_ref !== snapshot.orderRef || !Number.isInteger(ack.accepted_revision)
              || ack.accepted_revision < snapshot.revision || ack.accepted_revision > MAX_REVISION
              || !['accepted','duplicate','stale'].includes(ack.status)
              || (ack.status === 'stale' ? ack.accepted_revision <= snapshot.revision : ack.accepted_revision !== snapshot.revision)) fail('COLLECTOR_ACK_INVALID', true);
            if (await repository.complete(lease)) counts.delivered++;
          } catch (error) {
            const safe = resultError(error).error;
            await repository.retry({ ...lease,now:now(),code:safe.code });
            counts.retried++;
          }
        }
        return { ok:true,status:'flushed',...counts };
      } catch (error) { return { ...resultError(error),...counts }; }
    },
  });
}
