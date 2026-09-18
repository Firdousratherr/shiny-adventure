import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isSameOrigin(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return true;
  if (request.nextUrl.pathname === '/api/webhooks/razorpay') return true;
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host) {
    try { return new URL(origin).host === host; } catch { return false; }
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  return !fetchSite || ['same-origin', 'same-site', 'none'].includes(fetchSite);
}

export function middleware(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  const response = NextResponse.next();
  const h = response.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  h.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.public.blob.vercel-storage.com; font-src 'self' data:; connect-src 'self' https://*.razorpay.com; frame-src https://api.razorpay.com https://checkout.razorpay.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests");
  if (process.env.NODE_ENV === 'production') h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
