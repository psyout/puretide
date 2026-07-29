import { NextResponse } from 'next/server';
import { readSheetClients, upsertSheetClient } from '@/lib/stockSheet';
import { getOrderByOrderNumberFromDb } from '@/lib/ordersDb';
import { sendMail } from '@/lib/email';
import { verifyOrderConfirmationToken } from '@/lib/orderConfirmationToken';
import { checkRateLimit } from '@/lib/rateLimit';

interface SurveyRequest {
	orderNumber: string;
	customerEmail: string;
	confirmationToken: string;
	surveyData: {
		choice: 'search' | 'social' | 'friends' | 'ai' | 'ads' | 'other';
		otherText?: string;
	};
}

const SURVEY_CHOICES = new Set(['search', 'social', 'friends', 'ai', 'ads', 'other']);

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

export async function POST(request: Request) {
	try {
		const body: SurveyRequest = await request.json();
		const { orderNumber, customerEmail, confirmationToken, surveyData } = body;

		const { allowed } = checkRateLimit(request, 'survey', 10, 60 * 60 * 1000);
		if (!allowed) {
			return NextResponse.json({ ok: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
		}

		if (!orderNumber || !customerEmail || !surveyData || !verifyOrderConfirmationToken(String(orderNumber).trim(), confirmationToken)) {
			return NextResponse.json({ ok: false, error: 'Invalid survey request' }, { status: 401 });
		}
		if (!SURVEY_CHOICES.has(surveyData.choice)) {
			return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
		}
		const order = await getOrderByOrderNumberFromDb(String(orderNumber).trim());
		const orderCustomer = order ? ((order as Record<string, unknown>).customer as Record<string, unknown> | undefined) : undefined;
		const orderEmail = String(orderCustomer?.email ?? '')
			.trim()
			.toLowerCase();
		if (!order || !orderEmail || orderEmail !== String(customerEmail).trim().toLowerCase()) {
			return NextResponse.json({ ok: false, error: 'Invalid survey request' }, { status: 401 });
		}

		// Find existing client by email
		const clients = await readSheetClients();
		const existingClient = clients.find((client) => client.email.toLowerCase() === customerEmail.toLowerCase());

		if (!existingClient) {
			return NextResponse.json({ ok: false, error: 'Client not found' }, { status: 404 });
		}

		// Format survey data
		const otherText = String(surveyData.otherText ?? '').trim().slice(0, 500);
		const formattedSurveyData = surveyData.choice === 'other' && otherText ? `Other: ${otherText}` : surveyData.choice;

		// Update client with survey data
		const clientPayload = {
			email: existingClient.email,
			firstName: existingClient.firstName,
			lastName: existingClient.lastName,
			address: existingClient.address,
			city: existingClient.city,
			province: existingClient.province,
			zipCode: existingClient.zipCode,
			country: existingClient.country,
			orderTotal: existingClient.totalSpent,
			lastOrderDate: existingClient.lastOrderDate,
			productsPurchased: existingClient.products,
			howDidYouHear: formattedSurveyData,
		};

		await upsertSheetClient(clientPayload);
		const customerName = `${existingClient.firstName} ${existingClient.lastName}`.trim();
		const adminEmail = 'orders@puretide.ca';
		const text = [
			`How did you hear about us (survey submission)`,
			'',
			`Order: ${orderNumber}`,
			`Customer name: ${customerName || '(unknown)'}`,
			`Customer email: ${customerEmail}`,
			`Response: ${formattedSurveyData}`,
		].join('\n');
		const html = [
			`<p><strong>How did you hear about us (survey submission)</strong></p>`,
			`<p><strong>Order:</strong> ${escapeHtml(String(orderNumber))}</p>`,
			`<p><strong>Customer name:</strong> ${escapeHtml(customerName || '(unknown)')}</p>`,
			`<p><strong>Customer email:</strong> ${escapeHtml(String(customerEmail))}</p>`,
			`<p><strong>Response:</strong> ${escapeHtml(formattedSurveyData)}</p>`,
		].join('');

		const emailResult = await sendMail({
			to: adminEmail,
			subject: `Survey response - ${orderNumber}${customerName ? ` - ${customerName}` : ''}`,
			text,
			html,
			smtpPrefix: 'ORDER',
		});
		if (!emailResult.sent) {
			console.error('[Survey] Failed to send admin survey notification email:', emailResult.error);
		}

		console.log(`[Survey] Survey data updated for client ${customerEmail} from order ${orderNumber}`);

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error('[Survey] Error processing survey submission:', error);
		const message = error instanceof Error ? error.message : 'Failed to process survey';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
