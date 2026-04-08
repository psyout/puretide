#!/usr/bin/env node
/**
 * Comprehensive DNS Analysis Tool
 * Checks all DNS record types and identifies missing configurations
 * 
 * Usage: node scripts/check-all-dns.mjs [domain]
 * Example: node scripts/check-all-dns.mjs puretide.ca
 */

import { resolve4, resolve6, resolveMx, resolveTxt, resolveCname, resolveNs } from 'dns/promises';

const domain = process.argv[2] || 'puretide.ca';

console.log('🔍 Comprehensive DNS Analysis\n');
console.log('='.repeat(70));
console.log(`Domain: ${domain}`);
console.log('='.repeat(70));

const results = {
	a: null,
	aaaa: null,
	mx: null,
	txt: null,
	ns: null,
	dmarc: null,
	dkim: null,
};

// Check A records (IPv4)
async function checkA() {
	try {
		const records = await resolve4(domain);
		results.a = records;
		console.log('\n✅ A Records (IPv4):');
		records.forEach((ip) => console.log(`   ${ip}`));
		return true;
	} catch (error) {
		console.log('\n❌ A Records (IPv4): Not found');
		return false;
	}
}

// Check AAAA records (IPv6)
async function checkAAAA() {
	try {
		const records = await resolve6(domain);
		results.aaaa = records;
		console.log('\n✅ AAAA Records (IPv6):');
		records.forEach((ip) => console.log(`   ${ip}`));
		return true;
	} catch (error) {
		console.log('\n⚠️  AAAA Records (IPv6): Not configured (optional)');
		return false;
	}
}

// Check MX records (Email)
async function checkMX() {
	try {
		const records = await resolveMx(domain);
		results.mx = records;
		console.log('\n✅ MX Records (Email):');
		records
			.sort((a, b) => a.priority - b.priority)
			.forEach((mx) => console.log(`   Priority ${mx.priority}: ${mx.exchange}`));
		return true;
	} catch (error) {
		console.log('\n❌ MX Records (Email): Not found');
		console.log('   ⚠️  CRITICAL: Email delivery will not work!');
		return false;
	}
}

// Check TXT records
async function checkTXT() {
	try {
		const records = await resolveTxt(domain);
		results.txt = records;
		console.log('\n✅ TXT Records:');
		records.forEach((record, index) => {
			const txtValue = Array.isArray(record) ? record.join('') : record;
			console.log(`   ${index + 1}. "${txtValue}"`);
		});
		return records;
	} catch (error) {
		console.log('\n❌ TXT Records: Not found');
		return [];
	}
}

// Check DMARC record
async function checkDMARC() {
	try {
		const records = await resolveTxt(`_dmarc.${domain}`);
		results.dmarc = records;
		console.log('\n✅ DMARC Record (_dmarc):');
		records.forEach((record) => {
			const txtValue = Array.isArray(record) ? record.join('') : record;
			console.log(`   "${txtValue}"`);
		});
		return true;
	} catch (error) {
		console.log('\n❌ DMARC Record (_dmarc): Not found');
		console.log('   ⚠️  IMPORTANT: Email authentication not configured!');
		return false;
	}
}

// Check DKIM record (common selector)
async function checkDKIM() {
	const selectors = ['default', 'zoho', 'google', 'mail', 'k1', 'selector1', 'selector2'];
	let found = false;

	for (const selector of selectors) {
		try {
			const records = await resolveTxt(`${selector}._domainkey.${domain}`);
			if (!found) {
				console.log('\n✅ DKIM Record(s) Found:');
				found = true;
			}
			console.log(`   ${selector}._domainkey: Found`);
			results.dkim = results.dkim || [];
			results.dkim.push({ selector, records });
		} catch (error) {
			// Silent - only report if none found
		}
	}

	if (!found) {
		console.log('\n❌ DKIM Records: Not found');
		console.log('   ⚠️  IMPORTANT: Email signing not configured!');
		console.log(`   Checked selectors: ${selectors.join(', ')}`);
	}

	return found;
}

// Check NS records
async function checkNS() {
	try {
		const records = await resolveNs(domain);
		results.ns = records;
		console.log('\n✅ NS Records (Nameservers):');
		records.forEach((ns) => console.log(`   ${ns}`));
		return true;
	} catch (error) {
		console.log('\n❌ NS Records: Not found');
		return false;
	}
}

// Analyze TXT records for email security
function analyzeTXT(txtRecords) {
	const allRecords = txtRecords.flat().join(' ');
	const analysis = {
		spf: allRecords.includes('v=spf1'),
		dmarc: allRecords.includes('v=DMARC1'),
		zoho: allRecords.includes('zoho-verification'),
		google: allRecords.includes('google-site-verification'),
	};

	console.log('\n📊 TXT Record Analysis:');
	console.log(`   SPF: ${analysis.spf ? '✅ Found' : '❌ Missing'}`);
	console.log(`   DMARC (in root): ${analysis.dmarc ? '⚠️  Should be in _dmarc subdomain' : '✅ Correct'}`);
	console.log(`   Zoho Verification: ${analysis.zoho ? '✅ Found' : '❌ Missing'}`);
	console.log(`   Google Verification: ${analysis.google ? '✅ Found' : '⚠️  Not configured'}`);

	return analysis;
}

// Generate recommendations
function generateRecommendations(txtAnalysis) {
	console.log('\n' + '='.repeat(70));
	console.log('📋 MISSING DNS RECORDS & RECOMMENDATIONS');
	console.log('='.repeat(70));

	const missing = [];

	if (!results.a || results.a.length === 0) {
		missing.push({
			type: 'A Record',
			priority: 'CRITICAL',
			description: 'IPv4 address for website',
			action: 'Add A record pointing to your server IP (e.g., 82.221.139.21)',
		});
	}

	if (!results.mx || results.mx.length === 0) {
		missing.push({
			type: 'MX Records',
			priority: 'CRITICAL',
			description: 'Email delivery configuration',
			action: 'Add MX records for Zoho Mail (mx.zoho.com, mx2.zoho.com, mx3.zoho.com)',
		});
	}

	if (!txtAnalysis.spf) {
		missing.push({
			type: 'SPF Record',
			priority: 'HIGH',
			description: 'Email sender authentication',
			action: 'Already configured! ✅',
		});
	}

	if (!results.dmarc) {
		missing.push({
			type: 'DMARC Record',
			priority: 'HIGH',
			description: 'Email authentication policy',
			action: 'Add TXT record at _dmarc subdomain: v=DMARC1; p=quarantine; rua=mailto:info@puretide.ca',
		});
	}

	if (!results.dkim) {
		missing.push({
			type: 'DKIM Records',
			priority: 'HIGH',
			description: 'Email signature verification',
			action: 'Add DKIM records from Zoho Mail control panel',
		});
	}

	if (missing.length === 0) {
		console.log('\n🎉 All critical DNS records are configured!');
	} else {
		missing.forEach((item, index) => {
			console.log(`\n${index + 1}. ${item.type} [${item.priority}]`);
			console.log(`   Description: ${item.description}`);
			console.log(`   Action: ${item.action}`);
		});
	}

	// Email-specific summary
	console.log('\n' + '='.repeat(70));
	console.log('📧 EMAIL CONFIGURATION STATUS');
	console.log('='.repeat(70));

	const emailReady = results.mx && txtAnalysis.spf && results.dmarc && results.dkim;

	if (emailReady) {
		console.log('✅ Email system fully configured and ready!');
	} else {
		console.log('⚠️  Email system incomplete. Missing:');
		if (!results.mx) console.log('   - MX records (email routing)');
		if (!txtAnalysis.spf) console.log('   - SPF record (sender authentication)');
		if (!results.dmarc) console.log('   - DMARC record (email policy)');
		if (!results.dkim) console.log('   - DKIM records (email signing)');
	}
}

// Main execution
async function main() {
	await checkA();
	await checkAAAA();
	await checkMX();
	const txtRecords = await checkTXT();
	await checkDMARC();
	await checkDKIM();
	await checkNS();

	const txtAnalysis = analyzeTXT(txtRecords);
	generateRecommendations(txtAnalysis);

	console.log('\n' + '='.repeat(70));
	console.log('✅ DNS Analysis Complete');
	console.log('='.repeat(70));
	console.log('\n💡 To verify specific records:');
	console.log('   node scripts/verify-txt-dns.mjs puretide.ca');
	console.log('   node scripts/verify-txt-dns.mjs puretide.ca "v=DMARC1"');
	console.log('\n');
}

main().catch((error) => {
	console.error('\n❌ DNS analysis failed:', error.message);
	process.exit(1);
});
