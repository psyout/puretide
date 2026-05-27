#!/usr/bin/env npx tsx

// Test script to verify inactive products are filtered from stock alerts
import { readSheetProducts } from '../lib/stockSheet';
import { getProductsBelowReorderPoint } from '../lib/wrikeProducts';

console.log('🧪 Testing inactive product stock filtering...\n');

async function runTest() {
  try {
    // Test 1: Check readSheetProducts filtering
    console.log('📋 Test 1: Checking readSheetProducts...');
    const allProducts = await readSheetProducts();
    const lowStockProducts = allProducts.filter(p => p.stock <= 5);
    const activeLowStock = lowStockProducts.filter(p => p.status !== 'inactive');
    const inactiveLowStock = lowStockProducts.filter(p => p.status === 'inactive');
    
    console.log(`Total products: ${allProducts.length}`);
    console.log(`Products with stock <= 5: ${lowStockProducts.length}`);
    console.log(`Active low stock products: ${activeLowStock.length}`);
    console.log(`Inactive low stock products: ${inactiveLowStock.length}`);
    
    if (inactiveLowStock.length > 0) {
      console.log('\n🚫 Inactive products that would have triggered alerts:');
      inactiveLowStock.forEach(p => {
        console.log(`  - ${p.name} (${p.id}): stock=${p.stock}, status=${p.status}`);
      });
    }
    
    // Test 2: Check getProductsBelowReorderPoint filtering
    console.log('\n📋 Test 2: Checking getProductsBelowReorderPoint...');
    const belowReorderPoint = await getProductsBelowReorderPoint();
    console.log(`Products below reorder point (filtered): ${belowReorderPoint.length}`);
    
    if (belowReorderPoint.length > 0) {
      console.log('Products that WILL trigger alerts:');
      belowReorderPoint.forEach(p => {
        console.log(`  - ${p.productId}: stock=${p.stock}`);
      });
    }
    
    // Test 3: Verify filtering logic
    console.log('\n📋 Test 3: Verification...');
    const expectedAlerts = activeLowStock.length;
    const actualAlerts = belowReorderPoint.length;
    
    if (expectedAlerts === actualAlerts) {
      console.log('✅ SUCCESS: Filtering logic is working correctly!');
      console.log(`Expected ${expectedAlerts} alerts, got ${actualAlerts} alerts`);
    } else {
      console.log('❌ FAILURE: Filtering logic mismatch!');
      console.log(`Expected ${expectedAlerts} alerts, got ${actualAlerts} alerts`);
    }
    
    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runTest();
