# Privacy Shop - Anonymous E-Commerce

A privacy-focused e-commerce platform built with Next.js, designed to be hosted on Orange Website Island for maximum protection and anonymity.

## Features

-    🔒 **Privacy First**: No tracking scripts, no external analytics, no data collection
-    🛒 **Full E-Commerce**: Product catalog, shopping cart, and checkout flow
-    🎨 **Modern UI**: Beautiful, responsive design with dark theme
-    ⚡ **Fast**: Built with Next.js 14 and React 18
-    🔐 **Anonymous**: Designed for untraceable transactions

## Privacy Features

-    No external tracking scripts
-    No Google Analytics or similar services
-    No third-party cookies
-    Referrer policy set to "no-referrer"
-    Robots meta tags set to prevent indexing
-    All data stored locally (client-side only)
-    No telemetry collection

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

-    **Next.js 14** - React framework
-    **TypeScript** - Type safety
-    **Tailwind CSS** - Styling
-    **React Context** - State management

## License

Private - For use on Orange Website Island hosting only.
