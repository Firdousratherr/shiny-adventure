import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { trackingSchema } from '../../../../lib/validation';
import { rateLimit } from '../../../../lib/rate-limit';

export async function POST(request: Request) {
  try {
    const parsed = trackingSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Enter a valid order number and phone number.' }, { status: 400 });
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const key = `track:${ip}:${parsed.data.orderNumber.toUpperCase()}:${parsed.data.phone}`;
    const limited = await rateLimit(key, 10, 600);
    if (limited.limited) return NextResponse.json({ error: 'Too many tracking attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': '600' } });

    const order = await db.order.findFirst({
      where: { orderNumber: parsed.data.orderNumber.toUpperCase(), phone: parsed.data.phone },
      select: {
        orderNumber: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        courierName: true,
        trackingNumber: true,
        trackingUrl: true,
        items: { select: { productName: true, quantity: true, unitPrice: true } },
        // Do not expose internal admin notes to customers.
        history: { orderBy: { createdAt: 'asc' }, select: { oldStatus: true, newStatus: true, createdAt: true } },
      },
    });
    if (!order) return NextResponse.json({ error: 'Order not found. Check the details and try again.' }, { status: 404 });
    return NextResponse.json(order, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('tracking failed', error);
    return NextResponse.json({ error: 'Unable to track your order right now.' }, { status: 500 });
  }
}
