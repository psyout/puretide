import { NextResponse } from 'next/server';
import { buildSafeApiError } from '@/lib/apiError';
import { sendMail } from '@/lib/email';
import { isFriendsFamilyEnabled, normalizeEmail, startFriendsFamilyOtp } from '@/lib/friendsFamily';
import { buildBrandedEmail, emailInfoBox, escapeEmailHtml } from '@/lib/emailTemplate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = { email?: string };

export async function POST(request: Request) {
	try {
		const body = (await request.json()) as Body;
		const emailRaw = String(body?.email ?? '');
		const email = normalizeEmail(emailRaw);
		if (!isFriendsFamilyEnabled()) {
			return NextResponse.json({ ok: true, message: 'If this email is eligible, a verification code has been sent to you.' });
		}

		const result = await startFriendsFamilyOtp(request, email);

		// Only send email if eligible (code exists)
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
			const html = buildBrandedEmail({
				title: 'Your verification code',
				status: 'Friends & Family',
				preheader: 'Your Pure Tide verification code expires in 10 minutes.',
				bodyHtml: `<p>Use this code to complete your Friends &amp; Family verification:</p>${emailInfoBox(`<div style="text-align:center;color:#1e5260;font-size:28px;font-weight:700;letter-spacing:.16em">${escapeEmailHtml(code)}</div>`)}<p>This code expires in <strong>10 minutes</strong>.</p><p><strong>Do not share</strong> this code with anyone. If you did not request it, you can safely ignore this email.</p>`,
			});
			const emailResult = await sendMail({
				to: email,
				subject,
				text,
				html,
				smtpPrefix: 'ORDER',
			});
			if (!emailResult.sent) {
				console.error(
					JSON.stringify({
						label: 'friends-family:start:email-failed',
						error: emailResult.error ?? 'Unknown email delivery error',
					}),
				);
				return NextResponse.json(
					{
						ok: false,
						error: 'We could not send the verification email. Please try again in a moment.',
						eligible: false,
					},
					{ status: 502 },
				);
			}
		}

		return NextResponse.json({ ok: true, message: result.message, eligible: result.eligible });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to start verification.', error, logLabel: 'friends-family:start' });
		// Still non-enumerating; return generic success message even on internal errors.
		console.error(JSON.stringify({ label: 'friends-family:start:error', errorId: safe.errorId }));
		return NextResponse.json({ ok: true, message: 'If this email is eligible, a verification code has been sent.' }, { status: 200 });
	}
}
