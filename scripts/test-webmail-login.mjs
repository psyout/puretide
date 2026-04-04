#!/usr/bin/env node
/**
 * Test if we can verify the account exists and is accessible
 * This doesn't test webmail login, but provides info for manual verification
 */

import { config } from 'dotenv';
config();

console.log('🔍 SMTP Account Verification Checklist\n');
console.log('=' .repeat(60));

const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpHost = process.env.SMTP_HOST;

console.log('\n📋 Current Configuration:');
console.log('-'.repeat(60));
console.log(`SMTP Host: ${smtpHost}`);
console.log(`SMTP User: ${smtpUser}`);
console.log(`Password Length: ${smtpPass?.length || 0} characters`);
console.log(`Password starts with: ${smtpPass?.substring(0, 3)}...`);
console.log(`Password ends with: ...${smtpPass?.substring(smtpPass.length - 3)}`);

console.log('\n🔍 Password Analysis:');
console.log('-'.repeat(60));
console.log(`Has spaces: ${smtpPass?.includes(' ') ? '⚠️  YES (might cause issues)' : '✅ No'}`);
console.log(`Has quotes: ${smtpPass?.includes('"') || smtpPass?.includes("'") ? '⚠️  YES (might cause issues)' : '✅ No'}`);
console.log(`Has special chars: ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(smtpPass || '') ? '✅ Yes' : 'No'}`);

console.log('\n✅ Manual Verification Steps:');
console.log('-'.repeat(60));
console.log('\n1. Test webmail login:');
console.log(`   URL: https://${smtpHost} or https://webmail.puretide.ca`);
console.log(`   Username: ${smtpUser}`);
console.log(`   Password: (use password from .env file)`);
console.log('   → If login fails, password is wrong');
console.log('   → If login succeeds, continue to step 2');

console.log('\n2. Check email client settings in webmail:');
console.log('   → Look for "Email Client Configuration" or "SMTP Settings"');
console.log('   → Verify the exact username format required');
console.log('   → Check if SMTP is enabled');

console.log('\n3. Check hosting control panel:');
console.log('   → cPanel: Email Accounts → Configure Email Client');
console.log('   → Plesk: Mail → Email Addresses');
console.log('   → Verify SMTP authentication is enabled');

console.log('\n4. Common issues to check:');
console.log('   ❓ Is SMTP access enabled for this account?');
console.log('   ❓ Is two-factor authentication blocking SMTP?');
console.log('   ❓ Is the account locked due to failed login attempts?');
console.log('   ❓ Does the account require an app-specific password?');
console.log('   ❓ Is there an IP whitelist restriction?');

console.log('\n📞 Contact Hosting Support:');
console.log('-'.repeat(60));
console.log('If manual verification shows password is correct but SMTP fails:');
console.log('\nProvide this information:');
console.log(`  Account: ${smtpUser}`);
console.log(`  Server: ${smtpHost}`);
console.log('  Error: 535 5.7.8 Error: authentication failed');
console.log('  Ports tested: 465, 587, 25');
console.log('  Request: Enable SMTP access and verify credentials');

console.log('\n💡 Alternative Solution:');
console.log('-'.repeat(60));
console.log('If host SMTP continues to fail, consider using a dedicated SMTP service:');
console.log('  • SendGrid (free tier: 100 emails/day)');
console.log('  • Mailgun (free tier: 5,000 emails/month)');
console.log('  • Amazon SES (very cheap, pay-as-you-go)');
console.log('\nThese are more reliable than shared hosting SMTP.');

console.log('\n' + '='.repeat(60));
console.log('✅ Checklist complete\n');
