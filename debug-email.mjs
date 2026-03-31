// Simple email debug test
console.log('Testing email system...');

try {
  // Test basic email sending
  const response = await fetch('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer: {
        firstName: 'Debug',
        lastName: 'Test',
        email: 'debug@example.com',
        country: 'Canada',
        address: '123 Debug St',
        city: 'Vancouver',
        province: 'BC',
        zipCode: 'V6B 1A1',
        orderNotes: ''
      },
      shipToDifferentAddress: false,
      shippingMethod: 'regular',
      cartItems: [{
        id: '1',
        name: 'Debug Product',
        price: 1.00,
        quantity: 1
      }],
      subtotal: 1.00,
      shippingCost: 5.00,
      total: 6.00
    })
  });

  const result = await response.json();
  console.log('Order result:', result);
} catch (error) {
  console.error('Error:', error);
}
