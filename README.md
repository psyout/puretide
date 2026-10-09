# Pure Tide Store

Pure Tide's production e-commerce application. It is built with Next.js 14 and includes the public storefront, checkout and payment flows, inventory-backed product data, order fulfillment, customer email, and an authenticated operations dashboard.

The application is intended for self-hosted deployment with Next.js standalone output.

## Features

- Responsive product catalog, product details, cart, checkout, and order confirmation
- E-transfer and credit-card payment flows
- Server-side price, promotion, inventory, address, and customer validation
- Idempotent order creation and rate-limited public endpoints
- Selectable Zoho Inventory or Google Sheets product and stock catalog
- Google Sheets-backed promotions, clients, and Friends & Family access
- SQLite-backed order persistence using `sql.js`
- Zoho SMTP order, shipping, contact, and stock-alert emails
- Wrike order tasks, fulfillment workflows, and Avery 5162 shipping labels
- Authenticated operations dashboard for orders, stock, promotions, clients, and labels
- Friends-and-family checkout flow with email verification

## Privacy and Security

The site minimizes unnecessary data collection, but it is not an anonymous or client-only application. Order, customer, payment-status, and fulfillment data are processed server-side and shared with configured service providers as required to complete orders.

- No Google Analytics
- Optional Meta Pixel integration when configured
- Cart contents persist locally in the customer's browser
- Orders persist in the server-side order database
- CSP, HSTS in production, clickjacking protection, and restrictive permissions headers
- Search-engine indexing disabled with `X-Robots-Tag`
- Cookie-based dashboard sessions enforced by middleware
- API-key and secret protection for operational endpoints

Review the application's configuration and applicable privacy obligations before deploying it.

## Technology

- Next.js 14 App Router and React 18
- TypeScript
- Tailwind CSS
- Framer Motion and Lucide React
- Google APIs
- `sql.js`
- Nodemailer
- Zod

## Project Structure

```text
privacy-shop/
├── app/                  # Pages, layouts, and API routes
│   ├── api/              # Storefront, payment, webhook, cron, and dashboard APIs
│   ├── cart/             # Cart
│   ├── checkout/         # Checkout
│   ├── dashboard/        # Operations dashboard and login
│   ├── order-confirmation/
│   └── product/
├── components/           # Storefront and dashboard UI
├── context/              # Browser cart state
├── docs/                 # Email and integration notes
├── lib/                  # Domain logic and external integrations
├── scripts/              # Operations, diagnostics, migrations, and maintenance
├── tests/                # Node test suite
└── types/                # Shared TypeScript declarations
```

## Architecture

### Storefront and checkout

The App Router renders server components by default, with client components for the interactive cart and checkout. `context/CartContext.tsx` persists cart state in `localStorage`.

Checkout requests are recalculated and validated on the server. The server does not trust product prices, discounts, shipping costs, or totals supplied by the browser. An idempotency key reduces duplicate order submissions.

### Orders and fulfillment

`POST /api/orders` validates the customer, cart, inventory, promotion, shipping, and payment path before persisting the order. Fulfillment logic coordinates order status, stock updates, emails, and Wrike tasks. Retry cron routes handle recoverable background failures.

Orders are stored in a SQLite database managed through `sql.js`. Products and inventory can be sourced from Zoho Inventory, while promotions, client records, and Friends & Family access continue to use Google Sheets. Product reads are cached by the application.

### Payments

The application supports:

- E-transfer order creation and confirmation webhooks
- DigiPay credit-card checkout and postbacks
- GatewayLinx credit-card checkout and postbacks

The active card provider is selected through server and public environment variables. Provider credentials and webhook secrets must never be committed.

### Operations

The dashboard is available under `/dashboard` and protected by a signed, HTTP-only session cookie. It exposes operational views for stock, orders, clients, promotions, affiliate payouts, fulfillment health, tracking emails, and shipping labels.

Affiliate settings live in the `PromoCodes` Google Sheet. The dashboard maintains the columns `AffiliateName` and `CommissionPercentage` after the existing promo columns. A commission percentage greater than zero makes the code appear in **Dashboard → Affiliate Payouts**. Reports merge the order database with historical Wrike order tasks, show pending conversions separately, and count commission as owed only after payment is confirmed. Credit-card payment confirmation comes from the order database; manual e-transfer confirmation comes from the Wrike payment custom field being set to `Transferred`, which also triggers database fulfillment through the Wrike webhook. Completing a Wrike task is a shipping/tracking event and does not confirm payment. Commission is calculated on merchandise subtotal after the promo discount, excluding shipping and card fees. New orders store a commission snapshot so later rate changes do not alter historical payouts; older orders fall back to the currently configured rate.

Wrike integration can create order and client tasks, track fulfillment, and attach generated Avery 5162 label documents.

## Local Development

Requirements:

- Node.js 20 or a compatible current LTS release
- npm
- Environment credentials for each integration you intend to exercise

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Some storefront features can render without every integration configured, but checkout and operational routes require their corresponding credentials.

## Validation

Run the automated tests:

```bash
npm test
```

Build the production application:

```bash
npm run build
```

Email and integration-specific diagnostic scripts are available under `scripts/`. Many of them contact live services or mutate operational data; inspect a script and its required environment variables before running it.

## Configuration

Configuration is environment-driven. Major groups include:

- Zoho Inventory product and stock access
- Google Sheets promotions, clients, and Friends & Family access
- SMTP sender credentials
- DigiPay or GatewayLinx payment credentials
- Wrike API and folder identifiers
- Dashboard, cron, webhook, and orders API secrets
- Promotion, friends-and-family, and storefront feature flags

Use deployment secrets or a local uncommitted environment file. Do not put real credentials in source control.

### Zoho Inventory catalog

The integration uses each item's `Website Slug` as the website product ID. Only items with a slug are loaded, and only items whose `Website Status` is `published` are purchasable. Zoho-only/internal items can be omitted from the website by leaving the slug blank or using a non-published status.

For a read-only local test, add the following to `.env.local`:

```dotenv
ZOHO_INVENTORY_WRITE_ENABLED=false
ZOHO_INVENTORY_ORGANIZATION_ID=replace-with-your-organization-id
ZOHO_INVENTORY_CLIENT_ID=replace-with-your-client-id
ZOHO_INVENTORY_CLIENT_SECRET=replace-with-your-client-secret
ZOHO_INVENTORY_REFRESH_TOKEN=replace-with-your-refresh-token

# Use the matching Zoho data center when the account is not hosted in the US.
# Canada examples:
ZOHO_ACCOUNTS_BASE_URL=https://accounts.zohocloud.ca
ZOHO_INVENTORY_API_BASE_URL=https://www.zohoapis.ca/inventory/v1
```

Zoho Inventory is always the product catalog and stock source of truth; no product-source switch is required. The local diagnostic is read-only and prints a catalog summary without printing credentials:

```bash
npm run test:zoho:inventory
```

Stock writes require an additional `ZohoInventory.inventoryadjustments.CREATE` OAuth scope, `ZOHO_INVENTORY_ADJUSTMENT_ACCOUNT_ID`, and an explicit `ZOHO_INVENTORY_WRITE_ENABLED=true`. Keep writes disabled until a controlled checkout test is approved. The website dashboard intentionally refuses product edits because those changes belong in Zoho Inventory.

The dashboard's limited Website Status fallback requires the `ZohoInventory.items.UPDATE` OAuth scope. It can change only the `Website Status` custom field between `published`, `draft`, and `inactive`; all other product information remains managed in Zoho Inventory.

The catalog is cached for five minutes, item details are refreshed every six hours, and successful catalog reads are persisted beside `ORDERS_DB_PATH` as `zoho-products-cache.json` (or under `data/` when no orders database path is configured). Concurrent requests share one refresh, and a stale persisted catalog is used if Zoho is temporarily unavailable or rate-limited. These defaults keep normal usage below the Free-plan API allowance without additional environment variables. The intervals can be overridden with `ZOHO_INVENTORY_CATALOG_CACHE_TTL_MS`, `ZOHO_INVENTORY_DETAIL_CACHE_TTL_MS`, and `ZOHO_INVENTORY_CACHE_PATH` if needed.

### Email

Zoho Mail is the primary SMTP service used for order confirmations, shipping updates, contact submissions, and low-stock alerts.

```dotenv
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=orders@example.com
SMTP_PASS=replace-with-a-secret
SMTP_FROM=orders@example.com
```

Related setup notes:

- [Zoho migration](docs/MIGRATION-TO-ZOHO.md)
- [Mac Mail configuration](docs/MAC-MAIL-ZOHO-CONFIG.md)
- [Email migration guide](docs/EMAIL-MIGRATION-GUIDE.md)

### Abandoned-cart reminders

The storefront includes an optional, consent-based abandoned-cart reminder flow for the custom store. It does not depend on Zoho Campaigns: delivery uses the configured Zoho Mail SMTP account, while the operations dashboard controls the delay, retention period, test delivery, queue, retries, suppression, and live/pause state.

The feature has three independent safety gates and starts paused. Configure these variables, deploy, confirm every readiness check in **Dashboard → Abandoned Carts**, create an opted-in test cart, and use **Send test** before enabling live sending.

```dotenv
# Server-side deployment gate. The dashboard live switch is a separate gate.
ABANDONED_CART_FEATURE_ENABLED=true

# Use a separate random secret when possible. DASHBOARD_SECRET is a fallback.
ABANDONED_CART_SECRET=replace-with-a-long-random-secret

# Required identification included beside the unsubscribe link.
ABANDONED_CART_BUSINESS_ADDRESS=replace-with-your-complete-business-mailing-address
ABANDONED_CART_CONTACT_EMAIL=info@puretide.ca
ABANDONED_CART_FROM=info@puretide.ca
SITE_URL=https://puretide.ca

# Optional ABANDONED_CART_SMTP_* overrides; otherwise the shared SMTP_* values above are used.
ABANDONED_CART_SMTP_HOST=smtp.zoho.com
ABANDONED_CART_SMTP_PORT=465
ABANDONED_CART_SMTP_SECURE=true
ABANDONED_CART_SMTP_USER=info@puretide.ca
ABANDONED_CART_SMTP_PASS=replace-with-a-secret
```

Run the protected processor every five minutes. It sends at most one reminder per captured cart and rechecks suppression, completed orders, current stock, and current prices immediately before delivery.

```cron
*/5 * * * * curl -fsS -X POST "https://puretide.ca/api/cron/abandoned-carts" -H "x-cron-secret: $CRON_SECRET" >/dev/null
```

The checkout checkbox is optional and unchecked by default. It appears only when live sending is enabled and all required email/business configuration is present. Production use still requires the operator to confirm that the wording, business identification, privacy policy, retention, and consent records meet the laws applicable to the business and recipients.

## Shipping Labels

The application can generate Avery 5162 `.docx` sheets from order data and attach them to Wrike.

```dotenv
WRIKE_API_TOKEN=replace-with-a-secret
WRIKE_ORDERS_FOLDER_ID=replace-with-an-id
WRIKE_LABELS_FOLDER_ID=replace-with-an-id
CRON_SECRET=replace-with-a-secret
```

Labels can be generated from the dashboard or through the protected cron routes:

- `POST /api/cron/daily-labels`
- `POST /api/cron/afternoon-labels`
- `POST /api/cron/labels-range`

Send `CRON_SECRET` through the `x-cron-secret` header or a bearer authorization header.

Example:

```cron
5 6 * * * curl -fsS -X POST "https://YOUR_DOMAIN/api/cron/daily-labels" -H "x-cron-secret: $CRON_SECRET" >/dev/null
```

## Deployment

`next.config.js` enables `output: 'standalone'`. A production deployment must include:

- `.next/standalone`
- `.next/static`
- `public`
- Runtime environment variables and writable persistent storage for the order database

Build and start locally with:

```bash
npm run build
npm start
```

Production deployments must use HTTPS, preserve the database across releases, restrict dashboard and operational secrets, and configure authenticated webhooks for the selected payment provider.

## License

Private and proprietary.
