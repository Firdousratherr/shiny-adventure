import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { verifyWebhookSignature } from '../../../../../lib/razorpay';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';
  const eventId = request.headers.get('x-razorpay-event-id') || '';

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid Razorpay webhook signature.' }, { status: 400 });
  }

  if (!eventId) return NextResponse.json({ error: 'Missing Razorpay event id.' }, { status: 400 });

  try {
    const payload = JSON.parse(rawBody);
    const event = typeof payload?.event === 'string' ? payload.event : '';
    const entity = payload?.payload?.payment?.entity;

    const existing = await db.razorpayWebhookEvent.findUnique({ where: { eventId }, select: { id: true } });
    if (existing) return NextResponse.json({ ok: true });

    await db.razorpayWebhookEvent.create({
      data: { eventId, event, payload },
    });

    if (event !== 'payment.captured' || !entity?.order_id || !entity?.id) {
      return NextResponse.json({ ok: true });
    }

    const order = await db.order.findUnique({
      where: { razorpayOrderId: entity.order_id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        reservationExpiresAt: true,
        email: true,
      },
    });

    if (!order || order.status !== 'PAYMENT_PENDING') return NextResponse.json({ ok: true });

    const expectedAmount = Math.round(Number(order.totalAmount) * 100);
    if (Number(entity.amount) !== expectedAmount || entity.status !== 'captured') {
      return NextResponse.json({ ok: true });
    }

    await db.$transaction(async tx => {
      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          status: 'PAYMENT_PENDING',
          razorpayOrderId: entity.order_id,
        },
        data: {
          status: 'CONFIRMED',
          razorpayPaymentId: entity.id,
          paymentMethod: 'RAZORPAY',
          paymentVerifiedAt: new Date(),
          paymentVerifiedBy: 'RAZORPAY_WEBHOOK',
          paymentVerificationNote: 'Razorpay payment.captured webhook verified server-side.',
          paymentRejectionReason: null,
          reservationExpiresAt: null,
        },
      });

      if (claimed.count === 1) {
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            oldStatus: 'PAYMENT_PENDING',
            newStatus: 'CONFIRMED',
            changedBy: 'RAZORPAY_WEBHOOK',
            note: 'Razorpay payment captured webhook confirmed the order.',
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Razorpay retries failed webhook deliveries. Return 500 so a temporary
    // database failure can be retried rather than silently losing the event.
    console.error('razorpay webhook processing failed', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
