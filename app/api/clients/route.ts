import { NextResponse } from 'next/server';
import { readSheetClients } from '@/lib/stockSheet';
import { isExplicitDevBypassEnabled } from '@/lib/authEnv';
import { buildSafeApiError } from '@/lib/apiError';

function requireClientsApiKey(request: Request): boolean {
	const key = process.env.CLIENTS_API_KEY;
	if (!key) {
		return isExplicitDevBypassEnabled('ALLOW_UNAUTH_CLIENTS_API');
	}
	const provided = request.headers.get('x-api-key') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
	return provided === key;
}

export async function GET(request: Request) {
	if (!requireClientsApiKey(request)) {
		return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}
	try {
		const clients = await readSheetClients();
		return NextResponse.json({ ok: true, clients });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to read clients.', error, logLabel: 'clients:get' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
