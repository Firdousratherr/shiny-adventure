import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const productId = typeof body.productId === 'string' ? body.productId : '';
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 128) : '';
  if (!productId || !sessionId) return NextResponse.json({ error: 'Product and session are required.' }, { status: 400 });
  const session = await auth();
  const email = session?.user?.role === 'customer' ? session.user.email : null;
  const user = email ? await db.customerUser.findUnique({ where: { email }, select: { id: true } }) : null;
  await db.recentlyViewed.create({ data: { productId, sessionId, userId: user?.id ?? null } });
  return NextResponse.json({ ok: true });
}
