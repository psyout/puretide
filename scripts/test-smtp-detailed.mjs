#!/usr/bin/env node
/**
 * Detailed SMTP Authentication Test
 * Tests different username formats and ports
 */

import { config } from 'dotenv';
import nodemailer from 'nodemailer';

config();

const TEST_EMAIL = 'orders@puretide.ca';
const SMTP_HOST = process.env.SMTP_HOST || 'mail.puretide.ca';
const SMTP_PASS = process.env.SMTP_PASS;

console.log('🔍 Detailed SMTP Authentication Test\n');
console.log('=' .repeat(60));

// Test configurations to try
const testConfigs = [
	{
		name: 'Port 465 (SSL) - Full Email',
		host: SMTP_HOST,
		port: 465,
		secure: true,
		user: 'orders@puretide.ca',
	},
	{
		name: 'Port 465 (SSL) - Username Only',
		host: SMTP_HOST,
		port: 465,
		secure: true,
		user: 'orders',
	},
	{
		name: 'Port 587 (STARTTLS) - Full Email',
		host: SMTP_HOST,
		port: 587,
		secure: false,
		user: 'orders@puretide.ca',
	},
	{
		name: 'Port 587 (STARTTLS) - Username Only',
		host: SMTP_HOST,
		port: 587,
		secure: false,
		user: 'orders',
	},
	{
		name: 'Port 25 (Plain) - Full Email',
		host: SMTP_HOST,
		port: 25,
		secure: false,
		user: 'orders@puretide.ca',
	},
];

console.log(`Testing SMTP server: ${SMTP_HOST}`);
console.log(`Password: ${SMTP_PASS ? '✅ Set (hidden)' : '❌ Not set'}\n`);

if (!SMTP_PASS) {
	console.log('❌ SMTP_PASS not set in environment variables');
	process.exit(1);
}

let successfulConfig = null;

for (const testConfig of testConfigs) {
	console.log(`\n📧 Testing: ${testConfig.name}`);
	console.log('-'.repeat(60));
	console.log(`   Host: ${testConfig.host}:${testConfig.port}`);
	console.log(`   User: ${testConfig.user}`);
	console.log(`   Secure: ${testConfig.secure}`);

	try {
		const transporter = nodemailer.createTransport({
			host: testConfig.host,
			port: testConfig.port,
			secure: testConfig.secure,
			auth: {
				user: testConfig.user,
				pass: SMTP_PASS,
			},
			tls: {
				rejectUnauthorized: false, // Allow self-signed certificates
			},
		});

		// Test connection
		console.log('   Verifying connection...');
		await transporter.verify();
		console.log('   ✅ Connection verified!');

		// Try sending test email
		console.log('   Sending test email...');
		await transporter.sendMail({
			from: TEST_EMAIL,
			to: TEST_EMAIL,
			subject: '🧪 SMTP Test - ' + testConfig.name,
			text: `SMTP test successful using ${testConfig.name}`,
			html: `<p><strong>✅ SMTP test successful!</strong></p>
<p>Configuration: ${testConfig.name}</p>
<p>Host: ${testConfig.host}:${testConfig.port}</p>
<p>User: ${testConfig.user}</p>`,
		});

		console.log('   ✅ Test email sent successfully!');
		successfulConfig = testConfig;
		break; // Stop on first success

	} catch (error) {
		console.log(`   ❌ Failed: ${error.message}`);
		
		if (error.message.includes('ECONNREFUSED')) {
			console.log('   → Connection refused (port might be blocked)');
		} else if (error.message.includes('authentication')) {
			console.log('   → Authentication failed (wrong username/password)');
		} else if (error.message.includes('timeout')) {
			console.log('   → Connection timeout (firewall or network issue)');
		}
	}
}

console.log('\n' + '='.repeat(60));
console.log('📊 Test Results');
console.log('='.repeat(60));

if (successfulConfig) {
	console.log('\n✅ SUCCESS! Found working configuration:\n');
	console.log(`   Configuration: ${successfulConfig.name}`);
	console.log(`   Host: ${successfulConfig.host}`);
	console.log(`   Port: ${successfulConfig.port}`);
	console.log(`   User: ${successfulConfig.user}`);
	console.log(`   Secure: ${successfulConfig.secure}`);
	
	console.log('\n📝 Update your .env file with these settings:\n');
	console.log(`SMTP_HOST=${successfulConfig.host}`);
	console.log(`SMTP_PORT=${successfulConfig.port}`);
	console.log(`SMTP_SECURE=${successfulConfig.secure}`);
	console.log(`SMTP_USER=${successfulConfig.user}`);
	console.log(`SMTP_PASS=${SMTP_PASS}`);
	console.log(`SMTP_FROM=${TEST_EMAIL}`);
	
	console.log('\n✅ Check your inbox for test email!');
} else {
	console.log('\n❌ All configurations failed!\n');
	console.log('Possible issues:');
	console.log('  1. Wrong password');
	console.log('  2. Account locked or disabled');
	console.log('  3. SMTP access not enabled');
	console.log('  4. Two-factor authentication blocking SMTP');
	console.log('  5. IP address not whitelisted');
	console.log('  6. Firewall blocking SMTP ports');
	
	console.log('\n📞 Next steps:');
	console.log('  1. Verify password by logging into webmail');
	console.log('  2. Contact your email hosting provider');
	console.log('  3. Check if SMTP is enabled in control panel');
	console.log('  4. Verify account is active and not suspended');
}

console.log('\n');
