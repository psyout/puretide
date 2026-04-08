#!/usr/bin/env node
import nodemailer from 'nodemailer';

console.log('🔍 Testing info@puretide.ca Zoho SMTP\n');
console.log('============================================================\n');

const config = {
	host: 'smtp.zohocloud.ca',
	port: 465,
	secure: true,
	auth: {
		user: 'info@puretide.ca',
		pass: 'xU5284hNV1Qf',
	},
};

console.log('📋 Configuration:');
console.log('------------------------------------------------------------');
console.log(`Host: ${config.host}`);
console.log(`Port: ${config.port}`);
console.log(`Secure: ${config.secure}`);
console.log(`User: ${config.auth.user}`);
console.log(`Pass: ✅ Set (hidden)`);
console.log(`From: info@puretide.ca\n`);

console.log('📧 Testing Zoho Mail SMTP...');
console.log('------------------------------------------------------------');

try {
	console.log('Step 1: Creating transporter...');
	const transporter = nodemailer.createTransport(config);

	console.log('Step 2: Verifying connection...');
	await transporter.verify();
	console.log('✅ Connection verified!\n');

	console.log('Step 3: Sending test email...');
	const info = await transporter.sendMail({
		from: 'info@puretide.ca',
		to: 'info@puretide.ca',
		subject: 'Test from info@puretide.ca - Mac Mail Setup',
		text: 'This is a test email from info@puretide.ca to verify Zoho SMTP is working correctly.',
		html: '<p>This is a test email from <strong>info@puretide.ca</strong> to verify Zoho SMTP is working correctly.</p>',
	});

	console.log('✅ Test email sent successfully!');
	console.log(`   Message ID: ${info.messageId}`);
	console.log(`   From: info@puretide.ca`);
	console.log(`   To: info@puretide.ca\n`);

	console.log('============================================================');
	console.log('🎉 SUCCESS! info@puretide.ca SMTP is working!');
	console.log('============================================================\n');
	console.log('✅ Your email system is configured correctly');
	console.log('✅ You can now configure Mac Mail with these credentials');
	console.log('✅ Emails will be delivered successfully\n');
	console.log('📧 Check your inbox at: info@puretide.ca\n');
} catch (error) {
	console.error('❌ Error:', error.message);
	console.error('\nFull error:', error);
	process.exit(1);
}
