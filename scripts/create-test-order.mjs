import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const ORDERS_API_KEY = process.env.ORDERS_API_KEY;

if (!ORDERS_API_KEY) {
  console.error('ORDERS_API_KEY not set in .env');
  process.exit(1);
}

// Test product selected from previous script
const testProduct = {
  id: 'retatrutide',
  name: 'Retatrutide - 20mg',
  price: 70.99,
  quantity: 1,
  image: '/bottles/v06.webp',
  description: 'Triple‑agonist metabolic support for weight and glucose balance.',
};

const orderPayload = {
  customer: {
    firstName: 'Test',
    lastName: 'Customer',
    country: 'Canada',
    email: 'test@example.com',
    address: '123 Test Street',
    addressLine2: '',
    city: 'Toronto',
    province: 'ON',
    zipCode: 'M5V 1A1',
    orderNotes: 'STOCK DECREMENT TEST - DO NOT FULFILL',
  },
  shipToDifferentAddress: false,
  shippingMethod: 'regular',
  paymentMethod: 'etransfer',
  subtotal: testProduct.price * testProduct.quantity,
  shippingCost: 0,
  total: testProduct.price * testProduct.quantity,
  cartItems: [testProduct],
};

console.log('Creating test order...');
console.log('Product:', testProduct.name);
console.log('Quantity:', testProduct.quantity);
console.log('Total:', orderPayload.total);

try {
  const response = await fetch(`${API_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ORDERS_API_KEY,
    },
    body: JSON.stringify(orderPayload),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Order creation failed:', data);
    process.exit(1);
  }

  console.log('\n=== ORDER CREATED SUCCESSFULLY ===');
  console.log('Order ID:', data.orderId);
  console.log('Order Number:', data.orderNumber);
  console.log('Confirmation Token:', data.confirmationToken);
  console.log('\nWait 5 seconds for stock update to propagate...');
  
  // Wait for async stock update
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\nNow run: npx tsx scripts/test-stock-decrement.mjs');
  console.log('to verify the stock decreased correctly.');
  
} catch (error) {
  console.error('Error creating order:', error);
  process.exit(1);
}
