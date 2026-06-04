import { NextResponse } from 'next/server';
import { invalidateAllCaches } from '@/lib/sheetCache';

export async function POST(request: Request) {
  try {
    // Simple API key check for security
    const apiKey = request.headers.get('x-api-key');
    const validKey = process.env.STOCK_API_KEY;
    
    if (!apiKey || apiKey !== validKey) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Invalidate all caches
    invalidateAllCaches();
    
    return NextResponse.json({ 
      ok: true, 
      message: 'All caches invalidated successfully' 
    });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Failed to invalidate caches' 
    }, { status: 500 });
  }
}
