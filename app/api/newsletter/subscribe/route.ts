import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/email';
import { getCachedSheetPromoCodes } from '@/lib/sheetCache';
import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
const NEWSLETTER_PROMO_CODE = process.env.NEWSLETTER_PROMO_CODE || 'WELCOME10';

const NEWSLETTER_SHEET_NAME = 'Newsletter';

export const dynamic = 'force-dynamic';

interface NewsletterSubscriber {
	email: string;
	subscribedAt: string;
	codeSent: string;
}

function getSheetsClient() {
	if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
		throw new Error('Google Sheets credentials are not configured');
	}
	const auth = new google.auth.JWT({
		email: CLIENT_EMAIL,
		key: PRIVATE_KEY,
		scopes: ['https://www.googleapis.com/auth/spreadsheets'],
	});
	return google.sheets({ version: 'v4', auth });
}

async function ensureNewsletterSheetExists(sheets: ReturnType<typeof getSheetsClient>) {
	try {
		const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
		const sheetExists = spreadsheet.data.sheets?.some((s: { properties?: { title?: string } }) => s.properties?.title === NEWSLETTER_SHEET_NAME);

		if (!sheetExists) {
			await sheets.spreadsheets.batchUpdate({
				spreadsheetId: SHEET_ID,
				requestBody: {
					requests: [{ addSheet: { properties: { title: NEWSLETTER_SHEET_NAME } } }],
				},
			});
			await sheets.spreadsheets.values.update({
				spreadsheetId: SHEET_ID,
				range: `${NEWSLETTER_SHEET_NAME}!A1:C1`,
				valueInputOption: 'RAW',
				requestBody: { values: [['Email', 'Subscribed At', 'Code Sent']] },
			});
			console.log(`Created ${NEWSLETTER_SHEET_NAME} sheet`);
		}
	} catch (error) {
		console.error('Error ensuring newsletter sheet exists:', error);
		throw error;
	}
}

async function isEmailAlreadySubscribed(sheets: ReturnType<typeof getSheetsClient>, email: string): Promise<boolean> {
	try {
		const response = await sheets.spreadsheets.values.get({
			spreadsheetId: SHEET_ID,
			range: `${NEWSLETTER_SHEET_NAME}!A:C`,
		});

		const rows = response.data.values ?? [];
		if (rows.length <= 1) return false;

		const [, ...dataRows] = rows as string[][];
		return dataRows.some((row) => row[0]?.toLowerCase() === email.toLowerCase());
	} catch (error) {
		console.error('Error checking if email is subscribed:', error);
		return false;
	}
}

async function addNewsletterSubscriber(sheets: ReturnType<typeof getSheetsClient>, email: string, code: string) {
	const now = new Date();
	const subscribedAt = now.toISOString().slice(0, 10);
	await sheets.spreadsheets.values.append({
		spreadsheetId: SHEET_ID,
		range: `${NEWSLETTER_SHEET_NAME}!A:C`,
		valueInputOption: 'RAW',
		insertDataOption: 'INSERT_ROWS',
		requestBody: {
			values: [[email.toLowerCase(), subscribedAt, code]],
		},
	});
}

async function getPromoCode(): Promise<string> {
	try {
		const promoCodes = await getCachedSheetPromoCodes();
		const activePromo = promoCodes.find((p: { active: boolean; code: string }) => p.active && p.code === NEWSLETTER_PROMO_CODE);

		if (activePromo) {
			return activePromo.code;
		}

		// Fallback to the configured code if not found in sheet
		return NEWSLETTER_PROMO_CODE;
	} catch (error) {
		console.warn('Error reading promo codes from sheet, using fallback:', error);
		return NEWSLETTER_PROMO_CODE;
	}
}

async function sendWelcomeEmail(email: string, code: string): Promise<{ sent: boolean; error?: string }> {
	const subject = 'Your Exclusive 10% OFF Discount Code';
	const text = `Welcome to Pure Tide Wellness!

Thank you for subscribing to our newsletter. Here's your exclusive discount code:

${code}

Use this code at checkout to get 10% OFF your first order.

This code is valid for one-time use per customer.

Best regards,
The Pure Tide Team`;

	const html = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Your Exclusive Discount Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
	<div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
		<h1 style="color: #1a5f4a; text-align: center;">Welcome to Pure Tide Wellness!</h1>
		<p style="color: #333; line-height: 1.6;">Thank you for subscribing to our newsletter. Here's your exclusive discount code:</p>
		
		<div style="background-color: #1a5f4a; color: #ffffff; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
			<span style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${code}</span>
		</div>
		
		<p style="color: #333; line-height: 1.6;">Use this code at checkout to get <strong>10% OFF</strong> your first order.</p>
		<p style="color: #666; font-size: 14px;">This code is valid for one-time use per customer.</p>
		
		<p style="color: #333; line-height: 1.6; margin-top: 30px;">Best regards,<br>The Pure Tide Team</p>
	</div>
</body>
</html>`;

	return sendMail({
		to: email,
		subject,
		text,
		html,
		smtpPrefix: 'CONTACT',
	});
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { email } = body;

		if (!email || typeof email !== 'string') {
			return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
		}

		// Check Google Sheets configuration
		if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
			console.warn('Google Sheets not configured, skipping subscription tracking');
			// Still send the email even if sheets aren't configured
			const code = await getPromoCode();
			const emailResult = await sendWelcomeEmail(email, code);

			if (!emailResult.sent) {
				return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 });
			}

			return NextResponse.json({ success: true, message: 'Successfully subscribed' });
		}

		const sheets = getSheetsClient();

		// Ensure newsletter sheet exists
		await ensureNewsletterSheetExists(sheets);

		// Check if email is already subscribed
		const alreadySubscribed = await isEmailAlreadySubscribed(sheets, email);
		if (alreadySubscribed) {
			return NextResponse.json({ error: 'This email has already subscribed' }, { status: 409 });
		}

		// Get the promo code
		const code = await getPromoCode();

		// Send welcome email
		const emailResult = await sendWelcomeEmail(email, code);
		if (!emailResult.sent) {
			return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 });
		}

		// Add to newsletter subscribers
		await addNewsletterSubscriber(sheets, email, code);

		console.log(`Newsletter subscription successful: ${email}`);
		return NextResponse.json({ success: true, message: 'Successfully subscribed' });
	} catch (error) {
		console.error('Newsletter subscription error:', error);
		return NextResponse.json({ error: 'An error occurred while processing your subscription' }, { status: 500 });
	}
}
