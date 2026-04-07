#!/usr/bin/env node
/**
 * DNS TXT Record Verification Tool
 * Verifies TXT records for any domain
 *
 * Usage: node scripts/verify-txt-dns.mjs [domain]
 * Example: node scripts/verify-txt-dns.mjs puretide.ca
 */

import { resolveTxt } from 'dns/promises';

const domain = process.argv[2] || 'puretide.ca';

console.log('🔍 DNS TXT Record Verification\n');
console.log('='.repeat(60));
console.log(`Domain: ${domain}`);
console.log('='.repeat(60));

async function verifyTxtRecords() {
	try {
		console.log('\n📋 Querying TXT records...');

		const records = await resolveTxt(domain);

		console.log(`✅ Found ${records.length} TXT record(s):`);
		console.log('-'.repeat(60));

		records.forEach((record, index) => {
			const txtValue = Array.isArray(record) ? record.join('') : record;
			console.log(`\nRecord ${index + 1}:`);
			console.log(`"${txtValue}"`);
		});

		console.log('\n' + '='.repeat(60));
		console.log('🎉 TXT records verified successfully!');
		console.log('='.repeat(60));

		// Check for common verification records
		const allRecords = records.flat().join(' ');

		if (allRecords.includes('google-site-verification')) {
			console.log('\n🔍 Found Google Search Console verification');
		}

		if (allRecords.includes('v=spf1')) {
			console.log('\n📧 Found SPF record (email security)');
		}

		if (allRecords.includes('v=DMARC1')) {
			console.log('\n🛡️  Found DMARC record (email authentication)');
		}

		if (allRecords.includes('zoho-verification')) {
			console.log('\n🏢 Found Zoho verification record');
		}

		if (allRecords.includes('resend-verification')) {
			console.log('\n✉️  Found Resend verification record');
		}
	} catch (error) {
		console.log('\n❌ Failed to retrieve TXT records!');
		console.log(`   Error: ${error.message}`);

		if (error.code === 'ENOTFOUND') {
			console.log('\n⚠️  Domain not found:');
			console.log('   1. Check domain spelling');
			console.log('   2. Verify domain exists');
			console.log('   3. Check DNS propagation');
		}

		if (error.code === 'ENODATA') {
			console.log('\n⚠️  No TXT records found:');
			console.log('   1. Domain exists but has no TXT records');
			console.log('   2. Records may still be propagating');
			console.log('   3. Check DNS provider configuration');
		}

		console.log('\n📋 Common TXT record types:');
		console.log('   - Domain ownership verification');
		console.log('   - SPF (email security)');
		console.log('   - DMARC (email authentication)');
		console.log('   - Google Search Console');
		console.log('   - Zoho/Resend verification');

		process.exit(1);
	}
}

// Additional function to check specific TXT record
async function checkSpecificRecord(expectedValue) {
	try {
		const records = await resolveTxt(domain);
		const allRecords = records.flat();

		const found = allRecords.some((record) => record.includes(expectedValue) || record === expectedValue);

		if (found) {
			console.log(`\n✅ Found expected TXT record containing: "${expectedValue}"`);
			return true;
		} else {
			console.log(`\n❌ Expected TXT record not found: "${expectedValue}"`);
			console.log('   Current records:');
			allRecords.forEach((record) => console.log(`   - "${record}"`));
			return false;
		}
	} catch (error) {
		console.log(`\n❌ Error checking specific record: ${error.message}`);
		return false;
	}
}

// Main execution
if (process.argv[3]) {
	// Check for specific record value
	const expectedValue = process.argv[3];
	console.log(`\n🎯 Checking for specific TXT record: "${expectedValue}"`);
	await checkSpecificRecord(expectedValue);
} else {
	// Show all TXT records
	await verifyTxtRecords();
}

console.log('\n💡 Usage examples:');
console.log('   node scripts/verify-txt-dns.mjs puretide.ca');
console.log('   node scripts/verify-txt-dns.mjs puretide.ca "v=spf1"');
console.log('   node scripts/verify-txt-dns.mjs puretide.ca "google-site-verification"');
