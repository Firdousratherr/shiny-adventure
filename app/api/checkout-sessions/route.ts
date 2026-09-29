import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';
import { checkoutSessionSchema } from '../../../lib/validation';
import { rateLimit } from '../../../lib/rate-limit';

export async function POST(request: Request) {
  try {
    const limited = await rateLimit(
      'checkout-session:' + (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'),
      30,
      600,
    );
    if (limited.limited) {
      return NextResponse.json({ error: 'Too many checkout-session updates. Please try again later.' }, { status: 429, headers: { 'Retry-After': '600' } });
    }

    const parsed = checkoutSessionSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid checkout session data.' }, { status: 400 });

    const data = parsed.data;
    const session = await auth();
    const customer = session?.user?.role === 'customer' && session.user.email
      ? await db.customerUser.findUnique({ where: { email: session.user.email }, select: { id: true, email: true } })
      : null;

    const row = await db.checkoutSession.upsert({
      where: { sessionKey: data.sessionKey },
      create: {
        sessionKey: data.sessionKey,
        customerId: customer?.id || null,
        email: customer?.email || data.email || null,
        cartValue: data.cartValue ?? null,
        itemCount: data.itemCount ?? 0,
      },
      update: {
        customerId: customer?.id || undefined,
        email: customer?.email || data.email || undefined,
        cartValue: data.cartValue ?? undefined,
        itemCount: data.itemCount ?? 0,
        status: 'STARTED',
      },
    });

    return NextResponse.json({ ok: true, id: row.id });
  } catch (error) {
    console.error('checkout session tracking failed', error);
    return NextResponse.json({ error: 'Unable to save checkout session.' }, { status: 500 });
  }
}
