#!/usr/bin/env tsx

// Send a test admin order email with the new highlighted shipping address
import 'dotenv/config';
import { buildOrderEmails } from '../lib/orderEmail';
import { sendMail } from '../lib/email';

console.log('📧 Sending test admin order email with highlighted shipping address...\n');

async function sendTestAdminOrderEmail() {
  try {
    // Create test order data
    const testOrder = {
      orderNumber: 'TEST-2026-001',
      createdAt: new Date().toISOString(),
      paymentMethod: 'creditcard' as const,
      customer: {
        firstName: 'John',
        lastName: 'Smith',
        country: 'Canada',
        email: 'john.smith@example.com',
        address: '123 Main Street',
        addressLine2: 'Apt 4B, Tower Building',
        city: 'Toronto',
        province: 'Ontario',
        zipCode: 'M5V 2T6',
        orderNotes: 'Please deliver after 5 PM. Call 555-0123 upon arrival.',
      },
      shipToDifferentAddress: false,
      shippingMethod: 'express' as const,
      subtotal: 149.97,
      shippingCost: 15.00,
      discountAmount: 20.00,
      promoCode: 'SAVE20',
      total: 144.97,
      cartItems: [
        {
          id: 'bpc-157',
          name: 'BPC-157 Premium Peptide',
          price: 74.99,
          quantity: 2,
        },
      ],
    };

    // Build the admin email
    const emails = buildOrderEmails(testOrder);
    
    // Send the admin email to your address
    const result = await sendMail({
      to: 'contraviento@gmail.com',
      subject: emails.admin.subject,
      text: emails.admin.text,
      html: emails.admin.html,
      smtpPrefix: 'ORDER'
    });

    if (result.sent) {
      console.log('✅ Test admin order email sent successfully!');
      console.log('📬 Check your inbox at contraviento@gmail.com');
      console.log('\n🎯 What to look for:');
      console.log('  - Orange highlighted box with shipping address');
      console.log('  - 🚚 SHIPPING ADDRESS title');
      console.log('  - Clear, prominent address formatting');
      console.log('  - Professional order layout');
    } else {
      console.log('❌ Failed to send test admin order email');
      console.log('Error:', result.error);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

sendTestAdminOrderEmail();
