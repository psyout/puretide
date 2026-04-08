#!/usr/bin/env node

/**
 * Test Low Stock Email
 * Tests if low stock alerts are being sent correctly via Zoho Mail
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const LOW_STOCK_CONFIG = {
	host: process.env.LOW_STOCK_SMTP_HOST,
	port: Number(process.env.LOW_STOCK_SMTP_PORT),
	secure: process.env.LOW_STOCK_SMTP_SECURE === 'true',
	auth: {
		user: process.env.LOW_STOCK_SMTP_USER,
		pass: process.env.LOW_STOCK_SMTP_PASS,
	},
};

const from = process.env.LOW_STOCK_FROM || 'info@puretide.ca';
const to = process.env.LOW_STOCK_EMAIL || 'info@puretide.ca';

console.log('🧪 Testing Low Stock Email Configuration\n');
console.log('Configuration:');
console.log(`  Host: ${LOW_STOCK_CONFIG.host}`);
console.log(`  Port: ${LOW_STOCK_CONFIG.port}`);
console.log(`  Secure: ${LOW_STOCK_CONFIG.secure}`);
console.log(`  User: ${LOW_STOCK_CONFIG.auth.user}`);
console.log(`  From: ${from}`);
console.log(`  To: ${to}`);
console.log('');

// Validate configuration
if (!LOW_STOCK_CONFIG.host || !LOW_STOCK_CONFIG.port || !LOW_STOCK_CONFIG.auth.user || !LOW_STOCK_CONFIG.auth.pass) {
	console.error('❌ Missing LOW_STOCK SMTP configuration in .env file');
	console.error('   Required: LOW_STOCK_SMTP_HOST, LOW_STOCK_SMTP_PORT, LOW_STOCK_SMTP_USER, LOW_STOCK_SMTP_PASS');
	process.exit(1);
}

async function testLowStockEmail() {
	try {
		console.log('📧 Creating transporter...');
		const transporter = nodemailer.createTransport(LOW_STOCK_CONFIG);

		console.log('🔐 Verifying connection...');
		await transporter.verify();
		console.log('✅ Connection verified!\n');

		console.log('📤 Sending test low stock alert...');
		const testItems = [
			{ name: 'Test Product 1', slug: 'test-product-1', stock: 3 },
			{ name: 'Test Product 2', slug: 'test-product-2', stock: 1 },
		];

		const lines = testItems.map((item) => `- ${item.name} (${item.slug}): ${item.stock}`);
		const text = `Low stock alert (<= 5)\n\n${lines.join('\n')}\n\nThis is a test email.`;
		const html = `
			<p><strong>Low stock alert (<= 5)</strong></p>
			<ul>
				${lines.map((line) => `<li>${line}</li>`).join('')}
			</ul>
			<p><em>This is a test email.</em></p>
		`;

		const info = await transporter.sendMail({
			from,
			to,
			subject: '[TEST] Low stock alert',
			text,
			html,
		});

		console.log('✅ Test email sent successfully!');
		console.log(`   Message ID: ${info.messageId}`);
		console.log(`   From: ${from}`);
		console.log(`   To: ${to}`);
		console.log('\n✅ Low stock email system is working correctly!');
		console.log(`   Check ${to} for the test email.`);
	} catch (error) {
		console.error('\n❌ Test failed:', error.message);
		
		if (error.message.includes('authentication') || error.message.includes('Invalid login')) {
			console.error('\n🔍 Authentication Error:');
			console.error('   The Zoho Mail credentials for info@puretide.ca are incorrect.');
			console.error('   Check these environment variables in .env:');
			console.error('   - LOW_STOCK_SMTP_USER=info@puretide.ca');
			console.error('   - LOW_STOCK_SMTP_PASS=xU5284hNV1Qf');
		} else if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
			console.error('\n🔍 Connection Error:');
			console.error('   Cannot connect to smtp.zohocloud.ca');
			console.error('   Check your internet connection and firewall settings.');
		} else {
			console.error('\n🔍 Full error details:');
			console.error(error);
		}
		
		process.exit(1);
	}
}

testLowStockEmail();
