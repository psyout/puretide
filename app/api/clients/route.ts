import { NextResponse } from 'next/server';
import { readSheetClients } from '@/lib/stockSheet';

export async function GET() {
	try {
		const clients = await readSheetClients();
		return NextResponse.json({ ok: true, clients });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to read clients';
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
