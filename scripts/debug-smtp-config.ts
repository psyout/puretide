#!/usr/bin/env npx tsx

// Debug SMTP configuration to see what's available
import { getSmtpConfig } from '../lib/email';

console.log('🔍 Debugging SMTP Configuration...\n');

// Check environment variables
console.log('📋 Environment Variables:');
const smtpVars = [
  'SMTP_HOST',
  'SMTP_PORT', 
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'SMTP_SECURE',
  'ORDER_SMTP_HOST',
  'ORDER_SMTP_PORT',
  'ORDER_SMTP_USER',
  'ORDER_SMTP_PASS',
  'ORDER_SMTP_FROM'
];

smtpVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    if (varName.includes('PASS')) {
      console.log(`${varName}: ${value ? '***SET***' : 'NOT SET'}`);
    } else {
      console.log(`${varName}: ${value}`);
    }
  } else {
    console.log(`${varName}: NOT SET`);
  }
});

console.log('\n🔧 Testing getSmtpConfig():');

// Test default config
const defaultConfig = getSmtpConfig();
console.log('Default config:', defaultConfig ? 'FOUND' : 'NOT FOUND');

// Test ORDER config
const orderConfig = getSmtpConfig('ORDER');
console.log('ORDER config:', orderConfig ? 'FOUND' : 'NOT FOUND');

if (orderConfig) {
  console.log('ORDER SMTP details:');
  console.log(`  Host: ${orderConfig.host}`);
  console.log(`  Port: ${orderConfig.port}`);
  console.log(`  User: ${orderConfig.user}`);
  console.log(`  From: ${orderConfig.from}`);
  console.log(`  Secure: ${orderConfig.secure}`);
}
