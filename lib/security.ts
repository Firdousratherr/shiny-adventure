import { NextResponse } from 'next/server';

const SAFE_METHODS = new Set(['GET','HEAD','OPTIONS']);

export function requireSameOrigin(request: Request) {
  if (SAFE_METHODS.has(request.method)) return null;
  const pathname = new URL(request.url).pathname;
  if (pathname === '/api/webhooks/razorpay') return null;
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin) {
    try {
      if (new URL(origin).host !== host) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    } catch { return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 }); }
    return null;
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && !['same-origin','same-site','none'].includes(fetchSite)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  return null;
}
