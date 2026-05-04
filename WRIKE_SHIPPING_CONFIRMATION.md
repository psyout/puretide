# Wrike Shipping Confirmation System

This system automates shipping confirmation emails when orders are marked as completed in Wrike. It's designed to streamline your order fulfillment workflow with minimal manual input.

## Overview

**Workflow:**
1. Order placed → Wrike task created automatically
2. Ship order → Add tracking number to Wrike custom field
3. Mark task as "Completed" → Shipping email sent automatically
4. Customer receives tracking information

**Benefits:**
✅ **Automated emails** - No manual email sending
✅ **Professional templates** - Beautiful HTML emails with tracking links
✅ **Scalable** - Works for any order volume
✅ **Minimal input** - Only tracking number required
✅ **Audit trail** - All actions logged in Wrike

## Setup Instructions

### Step 1: Create Wrike Custom Field

1. Go to Wrike Account Settings → Custom Fields
2. Create new custom field:
   - **Name**: `Tracking Number`
   - **Type**: `Text`
   - **Apply to**: Orders folder
3. Note the field ID (you'll need it for the next step)

### Step 2: Configure Environment Variables

Add to your `.env` file:

```env
# Wrike Order Custom Fields (Shipping)
WRIKE_TRACKING_NUMBER_FIELD_ID=your_tracking_field_id_here

# Optional: Webhook security (recommended for production)
WRIKE_WEBHOOK_SECRET=your_random_secret_here
```

### Step 3: Create Wrike Webhook

Run the setup script to create the webhook:

```bash
node scripts/setup-wrike-shipping.mjs --webhook
```

This will:
- Create a webhook in Wrike for task status changes
- Generate a webhook secret
- Show you the exact values to add to your `.env` file

### Step 4: Validate Configuration

```bash
node scripts/setup-wrike-shipping.mjs --validate
```

### Step 5: Test the System

```bash
# Test complete workflow
node scripts/test-shipping-confirmation.mjs --workflow 12345 "123456789"

# Test manual API only
node scripts/test-shipping-confirmation.mjs --api 12345 "123456789"
```

## Daily Workflow

### For Each Order:

1. **Ship the order** using your normal process
2. **Add tracking number** in Wrike:
   - Open the order task
   - Find the "Tracking Number" custom field
   - Enter the tracking number (e.g., "123456789")
3. **Mark as completed**:
   - Change task status to "Completed"
   - **That's it!** Email sent automatically

### Manual Trigger (Backup)

If webhook fails or you need to send manually:

```bash
curl -X POST https://puretide.ca/api/shipping/confirm \
  -H "Content-Type: application/json" \
  -d '{"orderNumber":"12345","trackingNumber":"123456789"}'
```

## Email Template

The shipping confirmation email includes:

- **Order number** and customer name
- **Tracking number** with clickable link
- **Shipping method** (Standard/Express)
- **Delivery address** confirmation
- **Expected delivery timeline**
- **Contact information** for support

### Email Preview

```
Subject: Pure Tide - Your Order #12345 Has Shipped!

Dear John Doe,

Great news! Your Pure Tide order #12345 has been shipped...

TRACKING INFORMATION
====================
Tracking Number: 123456789
Shipping Method: Express Shipping

Track your package: [Canada Post Link]

DELIVERY ADDRESS
================
123 Main St
Apt 4B
Toronto, ON M5V 2N6
```

## Technical Details

### Files Created/Modified

**New Files:**
- `lib/shippingEmail.ts` - Email template and sending logic
- `lib/wrikeShipping.ts` - Wrike integration and automation
- `app/api/wrike/webhook/route.ts` - Webhook listener
- `app/api/shipping/confirm/route.ts` - Manual trigger API
- `scripts/setup-wrike-shipping.mjs` - Setup script
- `scripts/test-shipping-confirmation.mjs` - Test script

**Modified Files:**
- `.env` - Added tracking field ID
- `lib/env.ts` - Added environment validation

### Webhook Events

The system listens for:
- `task.status.changed` events in the Orders folder
- Specifically triggers on status change to "Completed"

### Security Features

- **Webhook signature verification** (optional but recommended)
- **Order validation** - Only processes actual order tasks
- **Error handling** - Graceful fallbacks and logging
- **Rate limiting** - Built into Next.js API routes

## Troubleshooting

### Common Issues

**1. Webhook not triggering**
- Check webhook is active in Wrike
- Verify webhook URL is accessible
- Check webhook secret matches in both places

**2. Email not sending**
- Check email configuration (Zoho SMTP)
- Verify customer email is extracted correctly
- Check logs for error messages

**3. Tracking number not found**
- Ensure custom field ID is correct in `.env`
- Verify field is applied to Orders folder
- Check tracking number is entered in Wrike

### Debug Commands

```bash
# Check webhook status
node scripts/setup-wrike-shipping.mjs --test

# List custom fields
node scripts/setup-wrike-shipping.mjs --list-fields

# Find specific order
node scripts/test-shipping-confirmation.mjs --find 12345
```

### Log Locations

- **Application logs**: Check your deployment logs
- **Wrike task**: Shipping confirmation logged in task description
- **Email logs**: Zoho SMTP logs (if configured)

## Advanced Features

### Custom Email Templates

Modify `lib/shippingEmail.ts` to customize:
- Email content and styling
- Additional tracking carriers
- Custom messaging per shipping method

### Multiple Carriers

Add carrier detection based on tracking number format:

```javascript
function detectCarrier(trackingNumber) {
  if (trackingNumber.startsWith('1Z')) return 'ups';
  if (trackingNumber.length === 12) return 'canadapost';
  return 'unknown';
}
```

### Batch Processing

For high-volume operations, consider:
- Queue system for email sending
- Batch webhook processing
- Scheduled sync as backup

## Monitoring and Analytics

### Key Metrics to Track

- **Webhook success rate**
- **Email delivery rate**
- **Time from shipment to email**
- **Customer click-through on tracking**

### Monitoring Setup

Add monitoring to track:
- Failed webhook deliveries
- Email bounce rates
- API response times

## Migration from Manual Process

### Before Automation
- Manual email composition
- Copy/paste tracking numbers
- Risk of human error
- Time-consuming for high volume

### After Automation
- One-click workflow
- Automated professional emails
- Error-free tracking links
- Scalable to any volume

## Support

For issues or questions:

1. **Check logs** - Both application and Wrike
2. **Run test script** - `node scripts/test-shipping-confirmation.mjs`
3. **Verify configuration** - `node scripts/setup-wrike-shipping.mjs --validate`
4. **Check webhook status** - In Wrike admin panel

## Future Enhancements

Potential improvements:
- **SMS notifications** for tracking updates
- **Delivery status monitoring** with automatic updates
- **Customer portal** for self-service tracking
- **Integration with other carriers** (UPS, FedEx)
- **Analytics dashboard** for shipping performance

---

**Ready to streamline your shipping workflow!** 🚚
