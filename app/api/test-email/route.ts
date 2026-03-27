import { sendMail } from '@/lib/email';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email address required' }, { status: 400 });
    }

    const result = await sendMail({
      to: email,
      subject: 'Production Email Test - Pure Tide',
      text: 'This is a test email from your production environment to verify Resend integration.',
      html: '<p>This is a test email from your <strong>production environment</strong> to verify Resend integration.</p><p>If you receive this, Resend is working correctly in production!</p>',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
