import { NextResponse } from 'next/server';
import { readSheetClients, upsertSheetClient } from '@/lib/stockSheet';
import { sendMail } from '@/lib/email';

interface SurveyRequest {
	orderNumber: string;
	customerEmail: string;
	surveyData: {
		choice: 'search' | 'social' | 'friends' | 'ai' | 'ads' | 'other';
		otherText?: string;
	};
}

export async function POST(request: Request) {
	try {
		const body: SurveyRequest = await request.json();
		const { orderNumber, customerEmail, surveyData } = body;

		if (!customerEmail || !surveyData) {
			return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
		}

		// Find existing client by email
		const clients = await readSheetClients();
		const existingClient = clients.find((client) => client.email.toLowerCase() === customerEmail.toLowerCase());

		if (!existingClient) {
			return NextResponse.json({ ok: false, error: 'Client not found' }, { status: 404 });
		}

		// Format survey data
		const formattedSurveyData = surveyData.choice === 'other' && surveyData.otherText ? `Other: ${surveyData.otherText}` : surveyData.choice;

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
			`<p><strong>Order:</strong> ${orderNumber}</p>`,
			`<p><strong>Customer name:</strong> ${customerName || '(unknown)'}</p>`,
			`<p><strong>Customer email:</strong> ${customerEmail}</p>`,
			`<p><strong>Response:</strong> ${formattedSurveyData}</p>`,
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
