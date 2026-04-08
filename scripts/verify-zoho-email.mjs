#!/usr/bin/env node
/**
 * Comprehensive Zoho Email Verification
 * Tests all aspects of Zoho Mail integration
 * 
 * Usage: node scripts/verify-zoho-email.mjs
 */

import { config } from 'dotenv';
import nodemailer from 'nodemailer';
import { resolveMx, resolveTxt } from 'dns/promises';

config();

console.log('🔍 Zoho Email System Verification\n');
console.log('='.repeat(70));

const domain = 'puretide.ca';
const results = {
	dns: { mx: false, spf: false, dmarc: false, dkim: false },
	smtp: { configured: false, connected: false, authenticated: false },
	email: { sent: false },
};

// Step 1: DNS Configuration Check
async function checkDNS() {
	console.log('\n📋 STEP 1: DNS Configuration');
	console.log('-'.repeat(70));

	// Check MX records
	try {
		const mxRecords = await resolveMx(domain);
		const hasZoho = mxRecords.some((mx) => mx.exchange.includes('zoho'));
		results.dns.mx = hasZoho;
		console.log(`✅ MX Records: ${hasZoho ? 'Zoho configured' : 'Found but not Zoho'}`);
		mxRecords.forEach((mx) => console.log(`   Priority ${mx.priority}: ${mx.exchange}`));
	} catch (error) {
		console.log('❌ MX Records: Not found');
		results.dns.mx = false;
	}

	// Check SPF
	try {
		const txtRecords = await resolveTxt(domain);
		const spfRecord = txtRecords.flat().find((r) => r.includes('v=spf1'));
		results.dns.spf = !!spfRecord;
		console.log(`${spfRecord ? '✅' : '❌'} SPF Record: ${spfRecord || 'Not found'}`);
	} catch (error) {
		console.log('❌ SPF Record: Not found');
		results.dns.spf = false;
	}

	// Check DMARC
	try {
		const dmarcRecords = await resolveTxt(`_dmarc.${domain}`);
		const dmarcRecord = dmarcRecords.flat().find((r) => r.includes('v=DMARC1'));
		results.dns.dmarc = !!dmarcRecord;
		console.log(`${dmarcRecord ? '✅' : '❌'} DMARC Record: ${dmarcRecord || 'Not found'}`);
	} catch (error) {
		console.log('❌ DMARC Record: Not found');
		results.dns.dmarc = false;
	}

	// Check DKIM
	try {
		const selectors = ['default', 'zoho', 'mail'];
		let foundDKIM = false;
		for (const selector of selectors) {
			try {
				await resolveTxt(`${selector}._domainkey.${domain}`);
				foundDKIM = true;
				console.log(`✅ DKIM Record: Found (${selector}._domainkey)`);
				break;
			} catch (e) {
				// Continue checking
			}
		}
		if (!foundDKIM) {
			console.log('❌ DKIM Record: Not found');
		}
		results.dns.dkim = foundDKIM;
	} catch (error) {
		console.log('❌ DKIM Record: Not found');
		results.dns.dkim = false;
	}
}

// Step 2: Environment Variables Check
function checkEnvVars() {
	console.log('\n⚙️  STEP 2: Environment Variables');
	console.log('-'.repeat(70));

	const required = {
		SMTP_HOST: process.env.SMTP_HOST,
		SMTP_PORT: process.env.SMTP_PORT,
		SMTP_SECURE: process.env.SMTP_SECURE,
		SMTP_USER: process.env.SMTP_USER,
		SMTP_PASS: process.env.SMTP_PASS,
		SMTP_FROM: process.env.SMTP_FROM,
	};

	let allConfigured = true;
	for (const [key, value] of Object.entries(required)) {
		if (!value) {
			console.log(`❌ ${key}: Not set`);
			allConfigured = false;
		} else {
			const displayValue = key === 'SMTP_PASS' ? '***hidden***' : value;
			console.log(`✅ ${key}: ${displayValue}`);
		}
	}

	results.smtp.configured = allConfigured;

	if (!allConfigured) {
		console.log('\n⚠️  Missing environment variables. Add to .env:');
		console.log('   SMTP_HOST=smtp.zoho.com');
		console.log('   SMTP_PORT=465');
		console.log('   SMTP_SECURE=true');
		console.log('   SMTP_USER=orders@puretide.ca');
		console.log('   SMTP_PASS=your_zoho_password');
		console.log('   SMTP_FROM=orders@puretide.ca');
	}

	return allConfigured;
}

// Step 3: SMTP Connection Test
async function testSMTPConnection() {
	console.log('\n🔌 STEP 3: SMTP Connection Test');
	console.log('-'.repeat(70));

	if (!results.smtp.configured) {
		console.log('⏭️  Skipped - environment variables not configured');
		return false;
	}

	const config = {
		host: process.env.SMTP_HOST,
		port: parseInt(process.env.SMTP_PORT || '465'),
		secure: process.env.SMTP_SECURE === 'true',
		auth: {
			user: process.env.SMTP_USER,
			pass: process.env.SMTP_PASS,
		},
	};

	try {
		const transporter = nodemailer.createTransport(config);
		console.log('Connecting to Zoho Mail SMTP...');
		await transporter.verify();
		console.log('✅ SMTP Connection: Successful');
		console.log('✅ Authentication: Successful');
		results.smtp.connected = true;
		results.smtp.authenticated = true;
		return transporter;
	} catch (error) {
		console.log('❌ SMTP Connection: Failed');
		console.log(`   Error: ${error.message}`);

		if (error.message.includes('Invalid login') || error.message.includes('authentication')) {
			console.log('\n💡 Authentication Tips:');
			console.log('   1. Verify SMTP_USER is your full Zoho email');
			console.log('   2. Verify SMTP_PASS is correct');
			console.log('   3. If 2FA enabled, use app-specific password');
			console.log('   4. Generate at: Zoho Mail → Settings → Security → App Passwords');
		}

		if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
			console.log('\n💡 Connection Tips:');
			console.log('   1. Check SMTP_HOST: smtp.zoho.com');
			console.log('   2. Check SMTP_PORT: 465 (SSL) or 587 (STARTTLS)');
			console.log('   3. Check firewall/network settings');
		}

		results.smtp.connected = false;
		results.smtp.authenticated = false;
		return null;
	}
}

// Step 4: Send Test Email
async function sendTestEmail(transporter) {
	console.log('\n📧 STEP 4: Send Test Email');
	console.log('-'.repeat(70));

	if (!transporter) {
		console.log('⏭️  Skipped - SMTP connection failed');
		return false;
	}

	const testEmail = process.env.SMTP_USER || 'orders@puretide.ca';

	try {
		console.log(`Sending test email to ${testEmail}...`);
		const info = await transporter.sendMail({
			from: process.env.SMTP_FROM || process.env.SMTP_USER,
			to: testEmail,
			subject: '✅ Zoho Email Verification - SUCCESS',
			text: `Zoho Mail is working correctly!

This test confirms:
✅ DNS records configured (MX, SPF, DMARC, DKIM)
✅ SMTP connection successful
✅ Authentication working
✅ Email delivery operational

Configuration:
- Host: ${process.env.SMTP_HOST}
- Port: ${process.env.SMTP_PORT}
- User: ${process.env.SMTP_USER}
- Secure: ${process.env.SMTP_SECURE}

Sent at: ${new Date().toISOString()}`,
			html: `<h2>✅ Zoho Mail is working correctly!</h2>

<p>This test confirms:</p>
<ul>
<li>✅ DNS records configured (MX, SPF, DMARC, DKIM)</li>
<li>✅ SMTP connection successful</li>
<li>✅ Authentication working</li>
<li>✅ Email delivery operational</li>
</ul>

<h3>Configuration:</h3>
<ul>
<li><strong>Host:</strong> ${process.env.SMTP_HOST}</li>
<li><strong>Port:</strong> ${process.env.SMTP_PORT}</li>
<li><strong>User:</strong> ${process.env.SMTP_USER}</li>
<li><strong>Secure:</strong> ${process.env.SMTP_SECURE}</li>
</ul>

<p><em>Sent at: ${new Date().toISOString()}</em></p>`,
		});

		console.log('✅ Test Email: Sent successfully');
		console.log(`   Message ID: ${info.messageId}`);
		console.log(`   To: ${testEmail}`);
		results.email.sent = true;
		return true;
	} catch (error) {
		console.log('❌ Test Email: Failed');
		console.log(`   Error: ${error.message}`);
		results.email.sent = false;
		return false;
	}
}

// Final Summary
function printSummary() {
	console.log('\n' + '='.repeat(70));
	console.log('📊 VERIFICATION SUMMARY');
	console.log('='.repeat(70));

	console.log('\n🌐 DNS Configuration:');
	console.log(`   MX Records (Zoho): ${results.dns.mx ? '✅' : '❌'}`);
	console.log(`   SPF Record: ${results.dns.spf ? '✅' : '❌'}`);
	console.log(`   DMARC Record: ${results.dns.dmarc ? '✅' : '❌'}`);
	console.log(`   DKIM Record: ${results.dns.dkim ? '✅' : '❌'}`);

	console.log('\n⚙️  SMTP Configuration:');
	console.log(`   Environment Variables: ${results.smtp.configured ? '✅' : '❌'}`);
	console.log(`   Connection: ${results.smtp.connected ? '✅' : '❌'}`);
	console.log(`   Authentication: ${results.smtp.authenticated ? '✅' : '❌'}`);

	console.log('\n📧 Email Delivery:');
	console.log(`   Test Email Sent: ${results.email.sent ? '✅' : '❌'}`);

	const allPassed =
		results.dns.mx &&
		results.dns.spf &&
		results.dns.dmarc &&
		results.dns.dkim &&
		results.smtp.configured &&
		results.smtp.connected &&
		results.smtp.authenticated &&
		results.email.sent;

	console.log('\n' + '='.repeat(70));
	if (allPassed) {
		console.log('🎉 ALL CHECKS PASSED - Zoho Email Fully Operational!');
		console.log('='.repeat(70));
		console.log('\n✅ Your email system is production-ready');
		console.log('✅ Order confirmations will be delivered');
		console.log('✅ Email deliverability is optimized');
		console.log('\n📧 Check your inbox for the test email');
	} else {
		console.log('⚠️  SOME CHECKS FAILED - Action Required');
		console.log('='.repeat(70));

		if (!results.dns.mx || !results.dns.spf || !results.dns.dmarc || !results.dns.dkim) {
			console.log('\n🔧 DNS Issues:');
			if (!results.dns.mx) console.log('   - Configure MX records for Zoho Mail');
			if (!results.dns.spf) console.log('   - Add SPF record');
			if (!results.dns.dmarc) console.log('   - Add DMARC record at _dmarc subdomain');
			if (!results.dns.dkim) console.log('   - Add DKIM records from Zoho control panel');
		}

		if (!results.smtp.configured || !results.smtp.connected || !results.smtp.authenticated) {
			console.log('\n🔧 SMTP Issues:');
			if (!results.smtp.configured) console.log('   - Configure environment variables in .env');
			if (!results.smtp.connected) console.log('   - Check SMTP host and port settings');
			if (!results.smtp.authenticated) console.log('   - Verify Zoho credentials (may need app password)');
		}

		if (!results.email.sent) {
			console.log('\n🔧 Email Delivery Issues:');
			console.log('   - Fix SMTP connection and authentication first');
		}
	}

	console.log('\n');
}

// Main execution
async function main() {
	await checkDNS();
	const envConfigured = checkEnvVars();
	const transporter = await testSMTPConnection();
	await sendTestEmail(transporter);
	printSummary();
}

main().catch((error) => {
	console.error('\n❌ Verification failed:', error.message);
	process.exit(1);
});
