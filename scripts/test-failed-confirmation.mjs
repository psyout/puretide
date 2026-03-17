#!/usr/bin/env node
/**
 * Simple test: Create a failed order directly and test the confirmation page
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { upsertOrderInDb } from '../lib/ordersDb.js';
import { createOrderConfirmationToken } from '../lib/orderConfirmationToken.js';

const BASE_URL = process.argv[2] || 'http://localhost:3001';

const failedOrder = {
  id: `order_${Date.now()}`,
  orderNumber: `test${Date.now().toString().slice(-6)}`,
  createdAt: new Date().toISOString(),
  paymentStatus: 'failed',
  paymentMethod: 'creditcard',
  paymentProvider: 'digipay',
  subtotal: 70.99,
  shippingCost: 20.0,
  total: 95.54,
  cardFee: 4.55,
  customer: {
    firstName: 'Test',
    lastName: 'FailedPayment',
    country: 'Canada',
    email: 'failed-test@example.com',
    address: '123 Test St',
    addressLine2: '',
    city: 'Vancouver',
    province: 'British Columbia',
    zipCode: 'V6B 1A1',
    orderNotes: 'Failed payment test',
  },
  shipToDifferentAddress: false,
  shippingMethod: 'express',
  cartItems: [{
    id: 1,
    name: 'BPC 157',
    price: 70.99,
    quantity: 1,
    image: '/bottles/v01.webp',
    description: 'Tissue repair and recovery support.',
  }],
  paymentFailure: {
    reason: 'insufficient_funds',
    providerStatus: 'failed',
    updatedAt: new Date().toISOString(),
  },
};

async function run() {
  console.log('Creating failed order in database...');
  
  try {
    await upsertOrderInDb(failedOrder);
    console.log('Failed order created:', failedOrder.orderNumber);
    
    const token = createOrderConfirmationToken(failedOrder.orderNumber);
    console.log('Token created:', token);
    
    const confirmationUrl = `${BASE_URL}/order-confirmation?orderNumber=${failedOrder.orderNumber}&token=${token}`;
    console.log('\nVisit this URL to test failed payment handling:');
    console.log(confirmationUrl);
    
    console.log('\nExpected behavior:');
    console.log('- Should show "Payment not completed" message');
    console.log('- Should NOT show success confirmation');
    console.log('- Cart should be cleared when returning to shop');
    console.log('- Should offer "Try again" and "Return to shop" buttons');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

run().catch(console.error);
