# Deployment Guide for Orange Website Island

This guide will help you deploy your Privacy Shop to Orange Website Island hosting.

## Pre-Deployment Checklist

✅ Project builds successfully (`npm run build`)
✅ All privacy features enabled (no tracking, no external scripts)
✅ HTTPS ready (Orange Website should provide SSL)

## Deployment Steps

### 1. Build the Project

```bash
npm run build
```

This creates an optimized production build in the `.next` folder.

### 2. Prepare Files for Upload

You'll need to upload:

-    `.next` folder (build output)
-    `public` folder (static assets)
-    `package.json` and `package-lock.json`
-    `next.config.js`
-    `node_modules` (or install on server)

### 3. Server Configuration

#### Option A: Node.js Server (Recommended)

If Orange Website supports Node.js:

1. Upload all project files
2. Run `npm install --production` on the server
3. Run `npm start` to start the server
4. Configure your domain to point to port 3000 (or use a reverse proxy)

#### Option B: Static Export (Alternative)

If you need static hosting, modify `next.config.js`:

```javascript
const nextConfig = {
	output: 'export',
	reactStrictMode: true,
	poweredByHeader: false,
};
```

Then run:

```bash
npm run build
```

This creates an `out` folder that can be uploaded to any static hosting.

### 4. Environment Setup

-    Ensure Node.js 18+ is installed on the server
-    Set up process manager (PM2 recommended) for production
-    Configure firewall to allow traffic on your chosen port
-    Configure SMTP env vars for order emails:
     -    `SMTP_HOST`
     -    `SMTP_PORT`
     -    `SMTP_USER`
     -    `SMTP_PASS`
     -    `SMTP_FROM`
     -    `SMTP_SECURE` (set to `true` for SMTPS/465)
     -    `SMTP_REPLY_TO` (optional)
     -    `SMTP_BCC` (optional admin copy)
     -    `ORDER_NOTIFICATION_EMAIL` (optional, defaults to `orders@puretide.ca`)
     -    `CONTACT_FROM` (optional, defaults to `SMTP_FROM`)

### 5. Security Considerations

-    Enable HTTPS/SSL certificate
-    Set up proper CORS headers if needed
-    Configure security headers in `next.config.js`:

```javascript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
      ],
    },
  ]
}
```

### 6. Privacy Verification

After deployment, verify:

-    No external tracking scripts are loaded
-    No third-party cookies are set
-    Referrer policy is set to "no-referrer"
-    Robots.txt is accessible and blocking crawlers

## Testing

1. Visit your deployed site
2. Test product browsing
3. Test adding items to cart
4. Test checkout flow
5. Verify no external requests in browser DevTools Network tab

## Support

For Orange Website specific hosting questions, consult their documentation or support team.
