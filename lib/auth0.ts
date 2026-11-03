import { Auth0Client } from '@auth0/nextjs-auth0/server';
import type { SessionData } from '@auth0/nextjs-auth0/types';

export function isAuth0Configured(): boolean {
	// Keep these references explicit. Next.js can inline statically referenced
	// environment variables into the Edge middleware bundle, but not dynamic
	// lookups such as process.env[name].
	return Boolean(
		process.env.AUTH0_DOMAIN?.trim() &&
			process.env.AUTH0_CLIENT_ID?.trim() &&
			process.env.AUTH0_CLIENT_SECRET?.trim() &&
			process.env.AUTH0_SECRET?.trim()
	);
}

function allowedDashboardEmails(): Set<string> {
	return new Set(
		(process.env.DASHBOARD_AUTH0_EMAILS ?? '')
			.split(',')
			.map((email) => email.trim().toLowerCase())
			.filter(Boolean)
	);
}

export function isAllowedDashboardSession(session: SessionData | null): boolean {
	const email = typeof session?.user?.email === 'string' ? session.user.email.trim().toLowerCase() : '';
	const emailVerified = session?.user?.email_verified === true;
	return emailVerified && Boolean(email) && allowedDashboardEmails().has(email);
}

let auth0Client: Auth0Client | null = null;

export function getAuth0Client(): Auth0Client | null {
	if (!isAuth0Configured()) return null;
	if (!auth0Client) {
		auth0Client = new Auth0Client({ signInReturnToPath: '/dashboard' });
	}
	return auth0Client;
}
