# Transaction flows verification

Thorough check of e-transfer and credit card paths to confirm **emails are sent** and **stock is decremented**.

---

## 1. E-transfer flow (POST /api/orders)

**Trigger:** Customer submits checkout with payment method “Interac e-Transfer”. Frontend calls `POST /api/orders` with full order payload.

**Code path:**

| Step | File | What happens |
|------|------|----------------|
| 1 | `app/api/orders/route.ts` | Rate limit, honeypot, cart, postal, customer, shipping (if different), stock validation. |
| 2 | Same | Build `payload` (cartItems, subtotal, shippingCost, discountAmount, total). |
| 3 | Same | Generate unique `orderNumber` (crypto.randomUUID), create `orderRecord` with `paymentStatus: 'paid'`. |
| 4 | Same | **Save order to DB** (`upsertOrderInDb`) so order exists even if email fails. |
| 5 | Same | `buildOrderEmails({ ...payload, orderNumber, createdAt })` from `lib/orderEmail.ts`. |
| 6 | Same | **Send customer email** – `sendOrderEmail(customerEmail, emailData.customer.*)` (local `sendOrderEmail` in route). |
| 7 | Same | **Send admin email** – `sendOrderEmail(adminRecipient, emailData.admin.*)`. |
| 8 | Same | Update order in DB with `emailStatus`, `adminEmailStatus`, email previews. |
| 9 | Same | **Stock update** – `updateSheetStock(payload.cartItems)` (local helper: readSheetProducts → decrement by quantity → writeSheetProducts → low stock alert). |
| 10 | Same | `upsertSheetClient` (marketing sheet), idempotency cache, return `{ ok: true, orderNumber }`. |

**Emails:** Customer and admin emails are sent in steps 6–7 via SMTP (ORDER_SMTP_* or SMTP_*). If SMTP is not configured, `sendOrderEmail` returns `{ sent: false, skipped: true }` and the order is still saved.

**Stock:** Step 9 reads current products from Google Sheet, decrements `product.stock - match.quantity` for each cart item (match by `item.id`/`product.id` or slug), writes back with `writeSheetProducts`, then sends low-stock alert if any product is at or below threshold.

**Conclusion:** E-transfer path sends both emails and updates sheet stock in the same request. No gaps.

---

## 2. Credit card flow (DigiPay create → postback)

**Trigger:** Customer submits checkout with “Credit card”. Frontend calls `POST /api/digipay/create`; server creates order with `paymentStatus: 'pending'`, returns `redirectUrl`; customer pays on DigiPay; DigiPay calls our **postback** with session + amount + status.

**Code path – Create (POST /api/digipay/create):**

| Step | File | What happens |
|------|------|--------------|
| 1 | `app/api/digipay/create/route.ts` | Validate payment method (credit card only), cart, postal, shipping, customer, stock. Reject total mismatch. |
| 2 | Same | Build payload, compute total, generate `orderNumber`, create `orderRecord` with `paymentStatus: 'pending'`. |
| 3 | Same | **Save order to DB** (`upsertOrderInDb`) – no email and no stock update yet. |
| 4 | Same | Return `{ ok: true, redirectUrl, orderNumber }`. Frontend redirects user to DigiPay. |

**Code path – Postback (POST /api/digipay/postback):**

| Step | File | What happens |
|------|------|----------------|
| 1 | `app/api/digipay/postback/route.ts` | IP allowlist check (DIGIPAY_POSTBACK_ALLOWED_IP). Reject if IP not allowed. |
| 2 | Same | HMAC verification (if DIGIPAY_POSTBACK_HMAC_SECRET set). |
| 3 | Same | Parse body (JSON or form), get `session` (= orderNumber), `status`/`result`, `amount`. |
| 4 | Same | Require approved status; load order by session; if already `paymentStatus === 'paid'`, return ok (idempotent). |
| 5 | Same | Validate amount matches `order.total`. |
| 6 | Same | **Run fulfillment first** – `runFulfillment(order)` from `lib/orderFulfillment.ts`: |
| 6a | `lib/orderFulfillment.ts` | `buildOrderEmails(...)` then **sendOrderEmail** (customer) and **sendOrderEmail** (admin). |
| 6b | Same | **updateSheetStock(order.cartItems)** – read products, decrement by quantity, write back, low-stock alert. |
| 7 | Same | If fulfillment throws, return XML fail and **do not** mark order paid (DigiPay may retry). |
| 8 | Same | **Mark order paid** – `upsertOrderInDb({ ...order, paymentStatus: 'paid', paidAt, fulfillmentStatus, emailStatus, adminEmailStatus })`. |
| 9 | Same | Return XML ok. |

**Emails:** Sent inside `runFulfillment` (orderFulfillment.sendOrderEmail × 2). Same SMTP config as e-transfer (getSmtpConfigLocal in orderFulfillment).

**Stock:** Updated inside `runFulfillment` via `updateSheetStock(order.cartItems)` in `lib/orderFulfillment.ts`. Same logic as orders route (read → decrement by cart → write).

**Conclusion:** Credit card path sends both emails and updates sheet stock in the postback, and only marks the order paid after fulfillment succeeds. No gaps.

---

## 3. Cross-checks

- **E-transfer** uses local `updateSheetStock` and local `sendOrderEmail` in `app/api/orders/route.ts`.  
- **Credit card** uses shared `runFulfillment` in `lib/orderFulfillment.ts` for both email and stock.  
- **Stock matching:** Both use `String(item.id) === product.id || String(item.id) === product.slug` so numeric or string ids from the cart work.  
- **Order in DB:** E-transfer saves with `paymentStatus: 'paid'` then emails then stock. Credit card saves with `paymentStatus: 'pending'` on create, then on postback runs fulfillment then sets `paymentStatus: 'paid'`.

---

## 4. How to simulate (see scripts/simulate-transactions.mjs)

- **E-transfer:** POST to `POST /api/orders` with a valid payload (customer, cart with product id that exists in your sheet or fallback products, correct total). Check inbox and sheet stock after.  
- **Credit card:**  
  1. POST to `POST /api/digipay/create` with same-style payload (paymentMethod: 'creditcard', cardFee, etc.) to get `orderNumber` (session).  
  2. POST to `POST /api/digipay/postback` with body containing `session=<orderNumber>`, `amount=<order.total>`, `status=approved` (or equivalent).  
  For local runs, add `127.0.0.1,::1` to `DIGIPAY_POSTBACK_ALLOWED_IP` so the postback request is accepted (IPv4 and IPv6 localhost).

Run the script with your app at `http://localhost:3000` (and .env with Sheets + SMTP) to verify emails and stock change.
