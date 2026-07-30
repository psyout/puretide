# Pure Tide Store

Pure Tide's production e-commerce application. It is built with Next.js 14 and includes the public storefront, checkout and payment flows, inventory-backed product data, order fulfillment, customer email, and an authenticated operations dashboard.

The application is intended for self-hosted deployment with Next.js standalone output.

## Features

- Responsive product catalog, product details, cart, checkout, and order confirmation
- E-transfer and credit-card payment flows
- Server-side price, promotion, inventory, address, and customer validation
- Idempotent order creation and rate-limited public endpoints
- Google Sheets-backed products, stock, promotions, and client data
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

Orders are stored in a SQLite database managed through `sql.js`. Products, inventory, promotions, and client records are sourced from Google Sheets and cached by the application.

### Payments

The application supports:

- E-transfer order creation and confirmation webhooks
- DigiPay credit-card checkout and postbacks
- GatewayLinx credit-card checkout and postbacks

The active card provider is selected through server and public environment variables. Provider credentials and webhook secrets must never be committed.

### Operations

The dashboard is available under `/dashboard` and protected by a signed, HTTP-only session cookie. It exposes operational views for stock, orders, clients, promotions, fulfillment health, tracking emails, and shipping labels.

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

- Google Sheets product and inventory access
- SMTP sender credentials
- DigiPay or GatewayLinx payment credentials
- Wrike API and folder identifiers
- Dashboard, cron, webhook, and orders API secrets
- Promotion, friends-and-family, and storefront feature flags

Use deployment secrets or a local uncommitted environment file. Do not put real credentials in source control.

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
