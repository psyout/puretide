#!/usr/bin/env npx tsx

// Test script to verify admin email shipping address highlighting
import { buildOrderEmails } from '../lib/orderEmail';

console.log('🧪 Testing admin email shipping address highlighting...\n');

// Create test order data
const testOrder = {
  orderNumber: 'TEST-001',
  createdAt: new Date().toISOString(),
  paymentMethod: 'creditcard' as const,
  customer: {
    firstName: 'John',
    lastName: 'Doe',
    country: 'Canada',
    email: 'john.doe@example.com',
    address: '123 Main St',
    addressLine2: 'Apt 4B',
    city: 'Toronto',
    province: 'ON',
    zipCode: 'M5V 2T6',
    orderNotes: 'Please deliver after 5 PM',
  },
  shipToDifferentAddress: false,
  shippingMethod: 'express' as const,
  subtotal: 99.99,
  shippingCost: 15.00,
  discountAmount: 10.00,
  promoCode: 'SAVE10',
  total: 104.99,
  cartItems: [
    {
      id: 'prod-1',
      name: 'Test Product 1',
      price: 49.99,
      quantity: 2,
    },
  ],
};

try {
  const emails = buildOrderEmails(testOrder);
  
  console.log('📧 Admin Email HTML Preview:');
  console.log('='.repeat(50));
  
  // Extract and show the shipping address section
  const adminHtml = emails.admin.html;
  const shippingSectionMatch = adminHtml.match(/<div style="margin: 24px 0; padding: 16px; border: 2px solid #ff6b35;[\s\S]*?<\/div>/);
  
  if (shippingSectionMatch) {
    console.log('✅ Found highlighted shipping address section:');
    console.log(shippingSectionMatch[0]);
  } else {
    console.log('❌ Shipping address section not found or not properly highlighted');
  }
  
  // Check for key styling elements
  const hasBorder = adminHtml.includes('border: 2px solid #ff6b35');
  const hasBackground = adminHtml.includes('background-color: #fff5f0');
  const hasIcon = adminHtml.includes('🚚');
  const hasBoldTitle = adminHtml.includes('SHIPPING ADDRESS');
  
  console.log('\n📋 Style Verification:');
  console.log(`✅ Orange border: ${hasBorder}`);
  console.log(`✅ Light background: ${hasBackground}`);
  console.log(`✅ Truck icon: ${hasIcon}`);
  console.log(`✅ Bold title: ${hasBoldTitle}`);
  
  if (hasBorder && hasBackground && hasIcon && hasBoldTitle) {
    console.log('\n🎉 SUCCESS: Admin email shipping address is properly highlighted!');
  } else {
    console.log('\n❌ FAILURE: Some styling elements are missing');
  }
  
  // Also test with different shipping address
  console.log('\n📋 Testing with different shipping address...');
  const testOrderWithDifferentShipping = {
    ...testOrder,
    shipToDifferentAddress: true,
    shippingAddress: {
      address: '456 Shipping Lane',
      addressLine2: 'Suite 100',
      city: 'Vancouver',
      province: 'BC',
      zipCode: 'V6B 2W1',
    },
  };
  
  const differentShippingEmails = buildOrderEmails(testOrderWithDifferentShipping);
  const differentShippingHtml = differentShippingEmails.admin.html;
  const differentShippingMatch = differentShippingHtml.match(/<div style="margin: 24px 0; padding: 16px; border: 2px solid #ff6b35;[\s\S]*?<\/div>/);
  
  if (differentShippingMatch) {
    console.log('✅ Different shipping address also properly highlighted');
  } else {
    console.log('❌ Different shipping address highlighting failed');
  }
  
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}
