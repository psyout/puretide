#!/usr/bin/env node
/**
 * Simulate e-transfer and credit card transactions to verify:
 * - Emails are sent (customer + admin)
 * - Stock is decremented in the sheet
 *
 * Prerequisites:
 * - App running (e.g. npm run dev) at BASE_URL (default http://localhost:3000)
 * - .env with: Google Sheets (products), SMTP (order emails), and for credit card
 *   add 127.0.0.1,::1 to DIGIPAY_POSTBACK_ALLOWED_IP so local postback is accepted
 *
 * Usage: node scripts/simulate-transactions.mjs [BASE_URL]
 *
 * When BASE_URL is http://localhost:3000, orders are stored in local data/orders.sqlite.
 * When BASE_URL is your production URL, orders are stored on the server's DB.
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';

const EXPRESS_SHIPPING = 35.0;
const CARD_FEE_PERCENT = 0.05;

const customer = {
  firstName: 'Test',
  lastName: 'Simulation',
  country: 'Canada',
  email: process.env.TEST_ORDER_EMAIL || 'test@example.com',
  address: '123 Test St',
  addressLine2: '',
  city: 'Vancouver',
  province: 'British Columbia',
  zipCode: 'V6B 1A1',
  orderNotes: 'Simulated order – safe to ignore',
};

// Use product id 1 (BPC 157 from fallback) – must exist in your sheet or fallback
const cartItem = {
  id: 1,
  name: 'BPC 157',
  price: 70.99,
  quantity: 1,
  image: '/bottles/v01.webp',
  description: 'Tissue repair and recovery support.',
};

const subtotalEtransfer = cartItem.price * cartItem.quantity;
const totalEtransfer = subtotalEtransfer + EXPRESS_SHIPPING;

const subtotalCard = cartItem.price * cartItem.quantity;
const cardFee = Number(((subtotalCard + EXPRESS_SHIPPING) * CARD_FEE_PERCENT).toFixed(2));
const totalCard = Number((subtotalCard + EXPRESS_SHIPPING + cardFee).toFixed(2));

const cartItems = [cartItem];

const basePayload = {
  customer,
  shipToDifferentAddress: false,
  shippingMethod: 'express',
  subtotal: subtotalEtransfer,
  shippingCost: EXPRESS_SHIPPING,
  total: totalEtransfer,
  cartItems: cartItems.map((item) => ({
    ...item,
    image: item.image || '',
    description: item.description || '',
  })),
};

async function run() {
  console.log('Base URL:', BASE_URL);
  console.log('');

  // --- 1. E-transfer ---
  console.log('--- 1. E-transfer (POST /api/orders) ---');
  const etransferPayload = {
    ...basePayload,
    paymentMethod: 'etransfer',
    discountAmount: undefined,
    promoCode: undefined,
    company: '', // honeypot
    idempotencyKey: `sim-etransfer-${Date.now()}`,
  };

  let etransferRes;
  try {
    etransferRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(etransferPayload),
    });
  } catch (e) {
    console.error('E-transfer request failed:', e.message);
    console.log('Is the app running at', BASE_URL, '?');
    process.exit(1);
  }

  const etransferText = await etransferRes.text();
  let etransferData;
  try {
    etransferData = JSON.parse(etransferText);
  } catch {
    console.error('E-transfer response was not JSON. Status:', etransferRes.status);
    console.error('Body (first 200 chars):', etransferText.slice(0, 200));
    process.exit(1);
  }
  if (!etransferRes.ok) {
    console.error('E-transfer failed:', etransferRes.status, etransferData);
  } else {
    console.log('E-transfer response:', etransferData);
    const orderNum = etransferData.orderNumber ?? etransferData.id ?? '?';
    console.log('');
    console.log('E-transfer email flow:');
    console.log('  1. Customer should receive order confirmation at:', customer.email);
    console.log('  2. Admin should receive notification at orders@puretide.ca (or ORDER_NOTIFICATION_EMAIL)');
    console.log('  Order number:', orderNum);
    console.log('  If no emails arrived, check server logs for "[Orders] Order', orderNum, 'admin email not sent: ..."');
    console.log('  Also check: product stock decreased by 1 in Google Sheet.');
  }
  console.log('');

  // --- 2. Credit card (create then postback) ---
  console.log('--- 2. Credit card (POST /api/digipay/create then POST /api/digipay/postback) ---');

  const cardPayload = {
    ...basePayload,
    paymentMethod: 'creditcard',
    cardFee,
    subtotal: subtotalCard,
    total: totalCard,
    discountAmount: undefined,
    promoCode: undefined,
    company: '',
    idempotencyKey: `sim-card-${Date.now()}`,
  };

  let createRes;
  try {
    createRes = await fetch(`${BASE_URL}/api/digipay/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardPayload),
    });
  } catch (e) {
    console.error('DigiPay create request failed:', e.message);
    process.exit(1);
  }

  const createData = await createRes.json();
  if (!createRes.ok || !createData.orderNumber) {
    console.error('DigiPay create failed:', createRes.status, createData);
    console.log('Skipping postback.');
    process.exit(1);
  }

  const session = createData.orderNumber;
  console.log('Create OK. Order/session:', session);

  // Simulate DigiPay postback (amount can be with dot or underscore)
  const postbackBody = new URLSearchParams({
    session,
    amount: String(totalCard),
    status: 'approved',
  }).toString();

  let postbackRes;
  try {
    postbackRes = await fetch(`${BASE_URL}/api/digipay/postback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postbackBody,
    });
  } catch (e) {
    console.error('Postback request failed:', e.message);
    process.exit(1);
  }

  const postbackText = await postbackRes.text();
  const ok = postbackText.includes('stat="ok"');
  if (!ok) {
    console.error('Postback failed (likely IP not allowlisted). Response:', postbackText.slice(0, 300));
    console.log('For local testing, add 127.0.0.1,::1 to DIGIPAY_POSTBACK_ALLOWED_IP in .env');
  } else {
    console.log('Postback OK. Order marked paid, fulfillment run.');
    console.log('Check: customer email + admin notification, and product stock decreased by 1 again.');
  }
  console.log('');
  console.log('Done. Verify inbox and Google Sheet stock for product id 1 (BPC 157).');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
