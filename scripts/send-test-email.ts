#!/usr/bin/env tsx

// Send a test email to verify email system is working
import 'dotenv/config';
import { sendMail } from '../lib/email';

console.log('📧 Sending test email to contraviento@gmail.com...\n');

async function sendTestEmail() {
	try {
		const result = await sendMail({
			to: 'contraviento@gmail.com',
			subject: '🧪 Pure Tide Email Test',
			text: `This is a test email from the Pure Tide email system.

Sent at: ${new Date().toLocaleString()}
System: Privacy Shop
Purpose: Email delivery verification

If you received this email, the SMTP configuration is working correctly!`,
			html: `
<div style="font-family: Arial, sans-serif; color: #0b3f3c; line-height: 1.5; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #0b3f3c; margin: 0 0 16px;">🧪 Pure Tide Email Test</h2>
  
  <div style="background-color: #f0f9f4; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <p style="margin: 0; font-weight: bold;">This is a test email from the Pure Tide email system.</p>
  </div>
  
  <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
  <p><strong>System:</strong> Privacy Shop</p>
  <p><strong>Purpose:</strong> Email delivery verification</p>
  
  <div style="background-color: #fff5f0; border: 2px solid #ff6b35; padding: 16px; border-radius: 8px; margin: 24px 0;">
    <h3 style="margin: 0 0 8px; color: #ff6b35;">✅ SUCCESS!</h3>
    <p style="margin: 0;">If you received this email, the SMTP configuration is working correctly!</p>
  </div>
  
  <p style="margin-top: 24px; font-size: 14px; color: #666;">
    This is an automated test message. No response is required.
  </p>
</div>`,
			smtpPrefix: 'ORDER',
		});

		if (result.sent) {
			console.log('✅ Test email sent successfully!');
			console.log('📬 Check your inbox at contraviento@gmail.com');
		} else {
			console.log('❌ Failed to send test email');
			console.log('Error:', result.error);
			console.log('\n🔧 Troubleshooting:');
			console.log('1. Check SMTP environment variables');
			console.log('2. Verify Zoho Mail credentials');
			console.log('3. Ensure network connectivity');
		}
	} catch (error) {
		console.error('❌ Unexpected error:', error);
	}
}

sendTestEmail();
