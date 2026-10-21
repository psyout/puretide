import { NextResponse } from 'next/server';

export function GET(request: Request) {
	return NextResponse.redirect(new URL('/dashboard/login?auth0=unavailable', request.url));
}
