import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '../../../../../lib/db';
import { verifyWebhookSignature } from '../../../../../lib/razorpay';
import { releasePaymentReservation } from '../../../../../lib/inventory-reservations';

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

    if (event !== 'payment.captured' || !entity?.order_id || !entity?.id) {
      await db.razorpayWebhookEvent.upsert({
        where: { eventId },
        create: { eventId, event, payload, processedAt: new Date() },
        update: {},
      });
      return NextResponse.json({ ok: true });
    }

    const existing = await db.razorpayWebhookEvent.findUnique({
      where: { eventId },
      select: { processedAt: true },
    });
    if (existing?.processedAt) return NextResponse.json({ ok: true });

    const expectedAmount = entity.amount;
    await db.$transaction(async tx => {
      await tx.razorpayWebhookEvent.upsert({
        where: { eventId },
        create: { eventId, event, payload },
        update: { payload, event },
      });

      const order = await tx.order.findUnique({
        where: { razorpayOrderId: entity.order_id },
        include: { items: true },
      });

      if (!order || order.status !== 'PAYMENT_PENDING') {
        await tx.razorpayWebhookEvent.update({
          where: { eventId },
          data: { processedAt: new Date(), processingError: null },
        });
        return;
      }

      const expectedOrderAmount = Math.round(Number(order.totalAmount) * 100);
      if (Number(expectedAmount) !== expectedOrderAmount || entity.status !== 'captured') {
        await tx.razorpayWebhookEvent.update({
          where: { eventId },
          data: { processedAt: new Date(), processingError: 'Captured payment amount/status did not match the Zenvora order.' },
        });
        return;
      }

      const now = new Date();
      if (!order.reservationExpiresAt || order.reservationExpiresAt <= now) {
        const claimed = await tx.order.updateMany({
          where: { id: order.id, status: 'PAYMENT_PENDING', reservationExpiresAt: { lte: now } },
          data: {
            status: 'CANCELLED',
            razorpayPaymentId: entity.id,
            paymentMethod: 'RAZORPAY',
            paymentVerifiedAt: now,
            paymentVerifiedBy: 'RAZORPAY_WEBHOOK_LATE',
            paymentVerificationNote: 'Razorpay payment was captured after the inventory reservation expired.',
            paymentRejectionReason: 'Payment captured after reservation expiry; refund review required.',
            cancellationReason: 'Payment captured after reservation expiry; refund review required.',
            reservationExpiresAt: null,
          },
        });

        if (claimed.count === 1) {
          await releasePaymentReservation(tx, order, 'PAYMENT_RESERVATION_LATE_CAPTURE_RELEASE');
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              oldStatus: 'PAYMENT_PENDING',
              newStatus: 'CANCELLED',
              changedBy: 'RAZORPAY_WEBHOOK_LATE',
              note: 'Late captured payment was recorded for refund review; expired inventory reservation and coupon usage were released.',
            },
          });
        }

        await tx.razorpayWebhookEvent.update({
          where: { eventId },
          data: { processedAt: new Date(), processingError: 'Late capture requires refund review.' },
        });
        return;
      }

      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          status: 'PAYMENT_PENDING',
          razorpayOrderId: entity.order_id,
          reservationExpiresAt: { gt: now },
        },
        data: {
          status: 'CONFIRMED',
          razorpayPaymentId: entity.id,
          paymentMethod: 'RAZORPAY',
          paymentVerifiedAt: now,
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

      await tx.razorpayWebhookEvent.update({
        where: { eventId },
        data: { processedAt: new Date(), processingError: null },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('razorpay webhook processing failed', error);
    try {
      await db.razorpayWebhookEvent.updateMany({
        where: { eventId },
        data: {
          processingError: error instanceof Error ? error.message.slice(0, 500) : 'Unknown webhook processing error',
        },
      });
    } catch (recordError) {
      console.error('razorpay webhook error recording failed', recordError);
    }
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
