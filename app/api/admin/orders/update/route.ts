import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { db } from '../../../../../lib/db';
import { Prisma, type OrderStatus } from '@prisma/client';
import { canTransition } from '../../../../../lib/orders/status';

const statuses = new Set<OrderStatus>(['CONFIRMED','ORDERED_FROM_SOURCE','SHIPPED','DELIVERED','CANCELLED','RTO','RETURN_REQUESTED','REFUNDED']);
const text = (v: unknown, max = 500) => typeof v === 'string' ? v.trim().slice(0, max) : '';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.formData();
    const orderNumber = text(body.get('orderNumber'), 50);
    const target = text(body.get('status'), 30) as OrderStatus;
    const note = text(body.get('note'));
    const sourceOrderId = text(body.get('sourceOrderId'), 100);
    const courierName = text(body.get('courierName'), 100);
    const trackingNumber = text(body.get('trackingNumber'), 150);
    const trackingUrl = text(body.get('trackingUrl'), 500);
    const refundMethod = text(body.get('refundMethod'), 80);
    const refundReference = text(body.get('refundReference'), 150);
    const refundRaw = text(body.get('refundAmount'), 30);
    if (!orderNumber || !statuses.has(target)) return NextResponse.json({ error: 'Invalid order update.' }, { status: 400 });
    const result = await db.$transaction(async tx => {
      const order = await tx.order.findUnique({ where: { orderNumber }, include: { items: true } });
      if (!order) throw new Error('NOT_FOUND');
      if (!canTransition(order.status, target)) throw new Error('INVALID_TRANSITION');
      let refundAmount: Prisma.Decimal | undefined;
      if (refundRaw) {
        try { refundAmount = new Prisma.Decimal(refundRaw); } catch { throw new Error('INVALID_REFUND'); }
        if (refundAmount.lessThan(0) || refundAmount.greaterThan(order.totalAmount)) throw new Error('INVALID_REFUND');
      }
      if (target === 'REFUNDED' && !refundAmount) refundAmount = order.totalAmount;
      if (target === 'REFUNDED' && !refundMethod) throw new Error('REFUND_METHOD_REQUIRED');
      if (target === 'CANCELLED' && order.status === 'CONFIRMED') {
        for (const item of order.items) await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
      const updated = await tx.order.update({ where: { id: order.id }, data: {
        status: target,
        sourceOrderId: sourceOrderId || order.sourceOrderId,
        courierName: courierName || order.courierName,
        trackingNumber: trackingNumber || order.trackingNumber,
        trackingUrl: trackingUrl || order.trackingUrl,
        cancellationReason: target === 'CANCELLED' ? (note || order.cancellationReason) : order.cancellationReason,
        refundAmount: refundAmount ?? order.refundAmount,
        refundMethod: refundMethod || order.refundMethod,
        refundReference: refundReference || order.refundReference,
        refundProcessedAt: target === 'REFUNDED' ? new Date() : order.refundProcessedAt,
      }, select: { orderNumber: true, status: true } });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, oldStatus: order.status, newStatus: target, changedBy: session.user.email!, note: note || null } });
      return updated;
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NOT_FOUND') return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    if (message === 'INVALID_TRANSITION') return NextResponse.json({ error: 'That status change is not allowed.' }, { status: 409 });
    if (message === 'INVALID_REFUND') return NextResponse.json({ error: 'Refund amount must be between ₹0 and the order total.' }, { status: 400 });
    if (message === 'REFUND_METHOD_REQUIRED') return NextResponse.json({ error: 'Refund method is required.' }, { status: 400 });
    console.error('admin order update failed', error);
    return NextResponse.json({ error: 'Unable to update order.' }, { status: 500 });
  }
}
