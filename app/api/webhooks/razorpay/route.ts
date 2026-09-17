import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { getRazorpay, verifyWebhookSignature } from '../../../../lib/razorpay';
import { notifyCustomer } from '../../../../lib/email';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';
  const eventId = request.headers.get('x-razorpay-event-id');
  if (!verifyWebhookSignature(rawBody, signature)) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  if (!eventId) return NextResponse.json({ error: 'Missing event id.' }, { status: 400 });

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 }); }
  const event = typeof payload?.event === 'string' ? payload.event : 'unknown';
  try {
    const existing = await db.razorpayWebhookEvent.findUnique({ where: { eventId } });
    if (existing?.processedAt) return NextResponse.json({ received: true, duplicate: true });
    if (!existing) {
      try { await db.razorpayWebhookEvent.create({ data: { eventId, event, payload } }); }
      catch (error) {
        const raced = await db.razorpayWebhookEvent.findUnique({ where: { eventId } });
        if (!raced) throw error;
      }
    }

    if (event !== 'order.paid' && event !== 'payment.captured') {
      await db.razorpayWebhookEvent.update({ where: { eventId }, data: { processedAt: new Date(), processingError: null } });
      return NextResponse.json({ received: true });
    }

    const paymentEntity = payload?.payload?.payment?.entity;
    const razorpayOrderId = typeof paymentEntity?.order_id === 'string' ? paymentEntity.order_id : '';
    const paymentId = typeof paymentEntity?.id === 'string' ? paymentEntity.id : '';
    const amount = Number(paymentEntity?.amount);
    if (!razorpayOrderId || !paymentId || !Number.isSafeInteger(amount)) throw new Error('INVALID_PAYMENT_PAYLOAD');
    const payment = await getRazorpay().payments.fetch(paymentId);
    if (payment.order_id !== razorpayOrderId || payment.status !== 'captured' || Number(payment.amount) !== amount) throw new Error('PAYMENT_NOT_CAPTURED_OR_AMOUNT_MISMATCH');

    const result = await db.$transaction(async tx => {
      const lockedEvent = await tx.$queryRaw<Array<{ processedAt: Date | null }>>`SELECT "processedAt" FROM "RazorpayWebhookEvent" WHERE "eventId" = ${eventId} FOR UPDATE`;
      if (!lockedEvent[0]) throw new Error('WEBHOOK_EVENT_NOT_FOUND');
      if (lockedEvent[0].processedAt) return null;
      const order = await tx.order.findUnique({ where: { razorpayOrderId }, include: { items: true } });
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (order.status !== 'PAYMENT_PENDING') {
        await tx.razorpayWebhookEvent.update({ where: { eventId }, data: { processedAt: new Date(), processingError: null } });
        return null;
      }
      if (Number(order.totalAmount) * 100 !== amount) throw new Error('ORDER_AMOUNT_MISMATCH');
      for (const item of order.items) {
        const updated = await tx.product.updateMany({ where: { id: item.productId, status: 'ACTIVE', stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
        if (updated.count !== 1) throw new Error(`INSUFFICIENT_STOCK:${item.productName}`);
        await tx.inventoryMovement.create({ data: { productId: item.productId, orderId: order.id, quantity: -item.quantity, reason: 'PAYMENT_CONFIRMED_DEDUCTION' } });
      }
      await tx.order.update({ where: { id: order.id }, data: { razorpayPaymentId: paymentId, paymentMethod: 'RAZORPAY', paymentVerifiedAt: new Date(), paymentVerifiedBy: 'RAZORPAY_WEBHOOK', paymentVerificationNote: `Razorpay ${event} webhook verified server-side.`, paymentRejectionReason: null, status: 'CONFIRMED' } });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, oldStatus: 'PAYMENT_PENDING', newStatus: 'CONFIRMED', changedBy: 'RAZORPAY_WEBHOOK', note: 'Razorpay payment captured and inventory deducted.' } });
      await tx.razorpayWebhookEvent.update({ where: { eventId }, data: { processedAt: new Date(), processingError: null } });
      return { orderNumber: order.orderNumber, email: order.email };
    });
    if (result?.email) void notifyCustomer(result.email, result.orderNumber, 'CONFIRMED', 'Your Razorpay payment has been verified and your order is being prepared.');
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_WEBHOOK_ERROR';
    try { await db.razorpayWebhookEvent.update({ where: { eventId }, data: { processingError: message } }); } catch {}
    console.error('razorpay webhook processing failed', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
