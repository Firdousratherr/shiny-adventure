import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';
import { securityRateLimit } from '../../../lib/rate-limit';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const productId = typeof body.productId === 'string' ? body.productId : '';
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 128) : '';
  if (!productId || !sessionId) return NextResponse.json({ error: 'Product and session are required.' }, { status: 400 });
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  const limited = await securityRateLimit('recently-viewed:'+sessionId, 60, 600);
  const ipLimited = await securityRateLimit('recently-viewed-ip:'+ip, 240, 600);
  if (limited.securityUnavailable || ipLimited.securityUnavailable) {
    return NextResponse.json({ error: 'Recently viewed tracking is temporarily unavailable.' }, { status: 503 });
  }
  if (limited.limited || ipLimited.limited) return NextResponse.json({ error: 'Too many recently-viewed events.' }, { status: 429, headers: { 'Retry-After': '600' } });
  const product = await db.product.findFirst({ where: { id: productId, status: 'ACTIVE' }, select: { id: true } });
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  const session = await auth();
  const email = session?.user?.role === 'customer' ? session.user.email : null;
  const user = email ? await db.customerUser.findUnique({ where: { email }, select: { id: true } }) : null;
  const existing = await db.recentlyViewed.findFirst({
    where: { productId, sessionId, userId: user?.id ?? null },
    select: { id: true },
  });
  if (existing) {
    await db.recentlyViewed.update({ where: { id: existing.id }, data: { viewedAt: new Date() } });
  } else {
    await db.recentlyViewed.create({ data: { productId, sessionId, userId: user?.id ?? null } });
  }
  return NextResponse.json({ ok: true });
}
