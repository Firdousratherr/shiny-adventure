import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const target = new URL('/api/orders/track', request.url);
  return NextResponse.redirect(target, 307);
}
