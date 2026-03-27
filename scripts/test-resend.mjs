import { sendMail } from '../lib/email.ts';

async function testResend() {
	console.log('Testing Resend email integration...');

	const result = await sendMail({
		to: 'info@puretide.ca', // Replace with your test email
		subject: 'Resend Test - Pure Tide',
		text: 'This is a test email sent via Resend integration.',
		html: '<p>This is a test email sent via <strong>Resend</strong> integration.</p><p>If you receive this, the integration is working correctly!</p>',
	});

	console.log('Test result:', result);

	if (result.sent) {
		console.log('✅ Email sent successfully!');
	} else {
		console.log('❌ Email failed to send:', result.error);
	}
}

testResend().catch(console.error);
