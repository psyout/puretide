import { NextResponse } from 'next/server';
import { requireDashboardAuth } from '@/lib/dashboardAuth';
import { readSheetClients } from '@/lib/stockSheet';

export async function GET(request: Request) {
	const authError = requireDashboardAuth(request);
	if (authError) return authError;
	try {
		const clients = await readSheetClients();
		return NextResponse.json({ ok: true, clients });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to read clients';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
