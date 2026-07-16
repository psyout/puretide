import { NextResponse } from 'next/server';
import { buildSafeApiError } from '@/lib/apiError';
import { sendMail } from '@/lib/email';
import { isFriendsFamilyEnabled, normalizeEmail, startFriendsFamilyOtp } from '@/lib/friendsFamily';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = { email?: string };

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as Body;
		const emailRaw = String(body?.email ?? '');
		const email = normalizeEmail(emailRaw);
		if (!isFriendsFamilyEnabled()) {
			return NextResponse.json({ ok: true, message: 'If this email is eligible, a verification code has been sent.' });
		}

		const result = await startFriendsFamilyOtp(request, email);

		// Non-enumerating behavior: we always return ok with the same message.
		// If eligible, an OTP record was created and we attempt to send the email.
		if (email && typeof result.code === 'string' && result.code.trim() !== '') {
			const code = result.code.trim();
			const subject = 'Your Pure Tide Friends & Family verification code';
			const text = [
				'Your Pure Tide Friends & Family verification code:',
				'',
				code,
				'',
				'This code expires in 10 minutes.',
				'Do not share this code with anyone.',
				'If you did not request this code, you can safely ignore this email.',
			].join('\n');
			const html = `
			<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0b3f3c;">
				<p><strong>Your Pure Tide Friends &amp; Family verification code:</strong></p>
				<p style="font-size: 24px; letter-spacing: 2px;"><strong>${code}</strong></p>
				<p>This code expires in <strong>10 minutes</strong>.</p>
				<p><strong>Do not share</strong> this code with anyone.</p>
				<p>If you did not request this code, you can safely ignore this email.</p>
			</div>
		`;
			void sendMail({
				to: email,
				subject,
				text,
				html,
				from: 'orders@puretide.ca',
				smtpPrefix: 'ORDER',
			});
		}

		return NextResponse.json({ ok: true, message: result.message });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to start verification.', error, logLabel: 'friends-family:start' });
		// Still non-enumerating; return generic success message even on internal errors.
		console.error(JSON.stringify({ label: 'friends-family:start:error', errorId: safe.errorId }));
		return NextResponse.json({ ok: true, message: 'If this email is eligible, a verification code has been sent.' }, { status: 200 });
	}
}
