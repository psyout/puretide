import { Auth0Client } from '@auth0/nextjs-auth0/server';
import type { SessionData } from '@auth0/nextjs-auth0/types';

const REQUIRED_AUTH0_ENV = ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_SECRET'] as const;

export function isAuth0Configured(): boolean {
	return REQUIRED_AUTH0_ENV.every((name) => Boolean(process.env[name]?.trim()));
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
