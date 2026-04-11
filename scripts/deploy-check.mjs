#!/usr/bin/env node

// Deployment readiness check script
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_ENV_VARS = [
  'DASHBOARD_SECRET',
  'NODE_ENV',
];

const RECOMMENDED_ENV_VARS = [
  'ORDERS_DB_PATH',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'ORDER_FROM',
  'ORDER_CONFIRMATION_SECRET',
];

const CRITICAL_FILES = [
  'lib/ordersDb.ts',
  'lib/email.ts',
  'lib/env.ts',
  'app/api/orders/route.ts',
  'app/api/survey/route.ts',
];

function checkEnvFile() {
  console.log('🔍 Checking .env file...');
  
  const envPath = resolve('.env');
  if (!existsSync(envPath)) {
    console.log('⚠️  No .env file found');
    return false;
  }

  const envContent = readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  const configuredVars = envLines.map(line => line.split('=')[0].trim());
  
  console.log('✅ Required environment variables:');
  let allRequired = true;
  for (const varName of REQUIRED_ENV_VARS) {
    if (configuredVars.includes(varName)) {
      console.log(`  ✓ ${varName}`);
    } else {
      console.log(`  ❌ ${varName} - MISSING`);
      allRequired = false;
    }
  }

  console.log('\n📋 Recommended environment variables:');
  for (const varName of RECOMMENDED_ENV_VARS) {
    if (configuredVars.includes(varName)) {
      console.log(`  ✓ ${varName}`);
    } else {
      console.log(`  ⚠️  ${varName} - not set (may cause issues)`);
    }
  }

  // Check for ORDERS_DB_PATH specifically
  if (!configuredVars.includes('ORDERS_DB_PATH')) {
    console.log('\n⚠️  ORDERS_DB_PATH not set - this may cause issues in standalone deployments');
    console.log('   Add: ORDERS_DB_PATH=/absolute/path/to/data/orders.sqlite');
  }

  return allRequired;
}

function checkCriticalFiles() {
  console.log('\n📁 Checking critical files...');
  
  let allExists = true;
  for (const file of CRITICAL_FILES) {
    if (existsSync(resolve(file))) {
      console.log(`  ✓ ${file}`);
    } else {
      console.log(`  ❌ ${file} - MISSING`);
      allExists = false;
    }
  }
  
  return allExists;
}

function checkPackageJson() {
  console.log('\n📦 Checking package.json...');
  
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    
    // Check for sql.js dependency
    if (packageJson.dependencies && packageJson.dependencies['sql.js']) {
      console.log('  ✓ sql.js dependency found');
    } else {
      console.log('  ❌ sql.js dependency missing');
      return false;
    }

    // Check for zod dependency
    if (packageJson.dependencies && packageJson.dependencies['zod']) {
      console.log('  ✓ zod dependency found');
    } else {
      console.log('  ❌ zod dependency missing');
      return false;
    }

    return true;
  } catch (error) {
    console.log('  ❌ Failed to read package.json');
    return false;
  }
}

function checkDataDirectory() {
  console.log('\n📂 Checking data directory...');
  
  const dataDir = resolve('data');
  if (!existsSync(dataDir)) {
    console.log('  ⚠️  data directory does not exist (will be created automatically)');
  } else {
    console.log('  ✓ data directory exists');
  }
  
  return true;
}

function main() {
  console.log('🚀 Deployment Readiness Check\n');
  
  const envOk = checkEnvFile();
  const filesOk = checkCriticalFiles();
  const packageOk = checkPackageJson();
  const dataOk = checkDataDirectory();
  
  console.log('\n' + '='.repeat(50));
  
  if (envOk && filesOk && packageOk && dataOk) {
    console.log('✅ All checks passed! Ready for deployment.');
    console.log('\n📝 Deployment reminders:');
    console.log('  • Set ORDERS_DB_PATH to absolute path on VPS');
    console.log('  • Ensure data directory is writable');
    console.log('  • Test email configuration after deployment');
    console.log('  • Monitor logs for any runtime errors');
  } else {
    console.log('❌ Some checks failed. Please address the issues above.');
    process.exit(1);
  }
}

main();
