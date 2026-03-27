# Resend Email Integration Setup

This integration adds Resend as the primary email service with SMTP fallback for better deliverability.

## Setup Instructions

### 1. Get Resend API Key
1. Go to https://resend.com/dashboard
2. Click "API Keys" in the left sidebar
3. Click "Create API Key"
4. Give it a name (e.g., "Pure Tide Production")
5. Copy the API key (starts with `re_`)

### 2. Add API Key to Environment
Add to your `.env` file:
```
RESEND_API_KEY=re_xxxxxxxxxxxxxx
```

### 3. (Optional) Verify Domain
1. In Resend dashboard, go to "Domains"
2. Click "Add Domain"
3. Enter `puretide.ca`
4. Add the DNS records they provide
5. This allows sending from `@puretide.ca` addresses

### 4. Test the Integration
```bash
# Edit the test script with your email address
# scripts/test-resend.mjs - change 'test@example.com' to your email

# Run the test
node scripts/test-resend.mjs
```

## How It Works

- **Primary**: Resend service (better deliverability, avoids IP reputation issues)
- **Fallback**: Your existing SMTP setup (if Resend fails)
- **Automatic**: No code changes needed - existing email functions work the same

## Benefits

✅ **Higher deliverability** - Resend's IPs have excellent reputation
✅ **Corporate email friendly** - Better delivery to business domains
✅ **Automatic fallback** - If Resend fails, SMTP still works
✅ **Zero disruption** - Your Mac Mail app continues working unchanged
✅ **Analytics** - View delivery stats in Resend dashboard

## Troubleshooting

### Email not sending?
1. Check that `RESEND_API_KEY` is set correctly
2. Verify your domain is verified in Resend (optional but recommended)
3. Check console logs for error messages
4. Test with the test script

### Still using SMTP?
- If Resend fails, the system automatically falls back to SMTP
- Check console logs for "Resend failed, falling back to SMTP" messages

### Want to disable Resend?
Simply remove the `RESEND_API_KEY` from your environment and the system will use SMTP only.

## Files Modified

- `lib/email.ts` - Added Resend integration with SMTP fallback
- `lib/env.ts` - Added RESEND_API_KEY to environment schema
- `scripts/test-resend.mjs` - Test script for verification
- `package.json` - Added resend dependency

## Production Deployment

After testing and confirming the setup works:

```bash
npm run build
./deploy.sh
```

The integration will automatically use Resend when the API key is available in production.
