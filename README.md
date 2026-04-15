# Privacy Shop - Anonymous E-Commerce

A privacy-focused e-commerce platform built with Next.js, designed to be hosted on Orange Website Island for maximum protection and anonymity.

## Features

- 🔒 **Privacy First**: No tracking scripts, no external analytics, no data collection
- 🛒 **Full E-Commerce**: Product catalog, shopping cart, and checkout flow
- 🎨 **Modern UI**: Beautiful, responsive design with dark theme
- ⚡ **Fast**: Built with Next.js 14 and React 18
- 🔐 **Anonymous**: Designed for untraceable transactions

## Privacy Features

- No external tracking scripts
- No Google Analytics or similar services
- No third-party cookies
- Referrer policy set to "no-referrer"
- Robots meta tags set to prevent indexing
- All data stored locally (client-side only)
- No telemetry collection

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Deployment to Orange Website Island

1. Build the project: `npm run build`
2. Upload the `.next` folder and all project files to your Orange Website hosting
3. Configure your server to run Next.js (or use static export if preferred)
4. Ensure HTTPS is enabled for secure connections

## Project Structure

```
privacy-shop/
├── app/              # Next.js app directory
│   ├── cart/         # Shopping cart page
│   ├── checkout/     # Checkout page
│   ├── product/      # Product detail pages
│   └── page.tsx      # Home page
├── components/       # React components
├── context/          # React context (Cart)
├── lib/              # Utilities and data
├── types/            # TypeScript types
└── public/           # Static assets
```

## Technologies

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Context** - State management
- **Zoho Mail** - Email service (SMTP)

## Architecture Overview

### Frontend

- **Routing/layout**: Next.js App Router (`app/`)
- **Components**: React Server Components by default, with client components used for interactive areas like cart/checkout
- **UI**:
     - Tailwind CSS for styling
     - `lucide-react` for icons
     - `framer-motion` for animations

### Cart & Checkout

- **Cart state**: client-side (`context/CartContext.tsx`) persisted in `localStorage`
- **Checkout UI/logic**: `components/CheckoutClient.tsx`
     - Calculates shipping, discounts, and fees
     - Uses an idempotency key to reduce duplicate submits
     - Supports e-transfer and credit card flows

### Backend (API routes)

- **Orders**: `POST /api/orders` stores orders and triggers side-effects (emails, stock sync, notifications)
- **Payments (credit card)**: `POST /api/digipay/create` generates a DigiPay redirect URL and persists the order
- **Operational concerns**: rate limiting, idempotency caching, and environment validation are enforced server-side

### Data & Integrations

- **Order persistence**: SQLite-backed storage via `sql.js` (see `lib/ordersDb.ts`)
- **Inventory/promo source of truth**: Google Sheets via `googleapis` (see `lib/stockSheet.ts` and `lib/sheetCache.ts`)
- **Work management**: optional Wrike integration for creating order/client tasks

### Security & Deployment

- **Security headers**: CSP, HSTS (prod), `X-Robots-Tag: noindex` configured in `next.config.js`
- **Dashboard auth**: middleware-enforced cookie-based session (`middleware.ts`)
- **Deployment output**: `output: 'standalone'` in `next.config.js` for smaller deploy footprint

## Email Configuration

This application uses **Zoho Mail** for all email functionality:

- Order confirmations
- Contact form submissions
- Low stock alerts

### Setup Email

1. **Create Zoho Mail account** - See [docs/MIGRATION-TO-ZOHO.md](docs/MIGRATION-TO-ZOHO.md)
2. **Configure DNS records** - MX, SPF, DKIM, DMARC
3. **Update .env file** with Zoho SMTP credentials:

```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=orders@puretide.ca
SMTP_PASS=your_zoho_password
SMTP_FROM=orders@puretide.ca
```

4. **Test email system:**

```bash
node scripts/test-zoho-smtp.mjs
node scripts/test-zoho-complete.mjs
```

### Email Documentation

- **[docs/MIGRATION-TO-ZOHO.md](docs/MIGRATION-TO-ZOHO.md)** - Migration details and Zoho setup context
- **[docs/MAC-MAIL-ZOHO-CONFIG.md](docs/MAC-MAIL-ZOHO-CONFIG.md)** - Mac Mail configuration
- **[docs/EMAIL-MIGRATION-GUIDE.md](docs/EMAIL-MIGRATION-GUIDE.md)** - Email system notes

### Benefits

- ✅ Professional business email
- ✅ No blacklist issues (clean IP reputation)
- ✅ High deliverability (99%+)
- ✅ Send AND receive emails
- ✅ IMAP/SMTP access for Mac Mail

## License

Private - For use on Orange Website Island hosting only.
