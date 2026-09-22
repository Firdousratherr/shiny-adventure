import { NextResponse } from 'next/server';
import { Prisma, type OrderStatus } from '@prisma/client';
import { db } from '../../../../../lib/db';
import { canTransition } from '../../../../../lib/orders/status';
import { notifyCustomer } from '../../../../../lib/email';
import { requireAdminPermission } from '../../../../../lib/admin-access';
import { releasePaymentReservation } from '../../../../../lib/inventory-reservations';
import { adjustInventoryBatch } from '../../../../../lib/inventory';

const statuses = new Set<OrderStatus>(['ORDERED_FROM_SOURCE','SHIPPED','DELIVERED','CANCELLED','RTO','RETURN_REQUESTED','REFUNDED']);
const text = (v: unknown, max = 500) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const statusMessage: Partial<Record<OrderStatus,string>> = { ORDERED_FROM_SOURCE:'Your order has been placed with the source supplier and is being prepared.', SHIPPED:'Your order has been shipped.', DELIVERED:'Your order has been marked as delivered.', CANCELLED:'Your order has been cancelled.', RTO:'Your order has been marked as returned to origin.', RETURN_REQUESTED:'Your return request has been recorded and is under review.', REFUNDED:'Your refund has been processed.' };

export async function POST(request: Request) {
  const admin = await requireAdminPermission('orders');
  const adminEmail = admin?.email || null;
  if (!adminEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.formData();
    const orderNumber = text(body.get('orderNumber'), 50).toUpperCase();
    const target = text(body.get('status'), 30) as OrderStatus;
    const note = text(body.get('note'));
    const sourceOrderId = text(body.get('sourceOrderId'), 100);
    const courierName = text(body.get('courierName'), 100);
    const trackingNumber = text(body.get('trackingNumber'), 150);
    const trackingUrl = text(body.get('trackingUrl'), 500);
    const refundMethod = text(body.get('refundMethod'), 80);
    const refundReference = text(body.get('refundReference'), 150);
    const refundRaw = text(body.get('refundAmount'), 30);
    if (!/^ORD-\d{4}-\d{4,}$/.test(orderNumber) || !statuses.has(target)) return NextResponse.json({ error: 'Invalid order update.' }, { status: 400 });
    if (trackingUrl && !/^https:\/\//i.test(trackingUrl)) return NextResponse.json({ error: 'Tracking URL must use HTTPS.' }, { status: 400 });

    const result = await db.$transaction(async tx => {
      const order = await tx.order.findUnique({ where: { orderNumber }, include: { items: true } });
      if (!order) throw new Error('NOT_FOUND');
      if (!canTransition(order.status, target)) throw new Error('INVALID_TRANSITION');

      let refundAmount: Prisma.Decimal | undefined;
      if (refundRaw) {
        try { refundAmount = new Prisma.Decimal(refundRaw); } catch { throw new Error('INVALID_REFUND'); }
        if (!refundAmount.isFinite() || refundAmount.lessThan(0) || refundAmount.greaterThan(order.totalAmount)) throw new Error('INVALID_REFUND');
      }
      if (target === 'REFUNDED' && !(await requireAdminPermission('payments'))) throw new Error('PAYMENTS_PERMISSION_REQUIRED');
      if (target === 'REFUNDED' && !refundAmount) refundAmount = order.totalAmount;
      if (target === 'REFUNDED' && !refundMethod) throw new Error('REFUND_METHOD_REQUIRED');
      if (target === 'REFUNDED' && !refundReference) throw new Error('REFUND_REFERENCE_REQUIRED');
      if (target === 'RTO' && !note) throw new Error('RTO_REASON_REQUIRED');

      const shouldReleaseReservation = target === 'CANCELLED' && order.status === 'PAYMENT_PENDING';
      const shouldRestore = target === 'CANCELLED' && order.status === 'CONFIRMED';
      const shouldRestockRto = target === 'RTO' && order.status === 'SHIPPED';
      if (shouldReleaseReservation) {
        await releasePaymentReservation(tx, order, 'PAYMENT_RESERVATION_RELEASE');
      } else if (shouldRestore || shouldRestockRto) {
        await adjustInventoryBatch(tx, order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          orderId: order.id,
          reason: shouldRestockRto ? 'RTO_RESTOCK' : 'CANCELLED_RESTOCK',
        })));
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
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
          reservationExpiresAt: shouldReleaseReservation ? null : order.reservationExpiresAt,
        },
        select: { orderNumber: true, status: true, email: true },
      });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, oldStatus: order.status, newStatus: target, changedBy: adminEmail, note: note || null } });
      return updated;
    });

    if (result.email && statusMessage[target]) void notifyCustomer(result.email, result.orderNumber, target, statusMessage[target]);
    return NextResponse.json({ orderNumber: result.orderNumber, status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NOT_FOUND') return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    if (message === 'INVALID_TRANSITION') return NextResponse.json({ error: 'That status change is not allowed.' }, { status: 409 });
    if (message === 'INVALID_REFUND') return NextResponse.json({ error: 'Refund amount must be between ₹0 and the order total.' }, { status: 400 });
    if (message === 'REFUND_METHOD_REQUIRED') return NextResponse.json({ error: 'Refund method is required.' }, { status: 400 });
    if (message === 'REFUND_REFERENCE_REQUIRED') return NextResponse.json({ error: 'Refund reference is required.' }, { status: 400 });
    if (message === 'PAYMENTS_PERMISSION_REQUIRED') return NextResponse.json({ error: 'Payments permission required to process refunds.' }, { status: 403 });
    if (message === 'RTO_REASON_REQUIRED') return NextResponse.json({ error: 'RTO reason is required.' }, { status: 400 });
    console.error('admin order update failed', error);
    return NextResponse.json({ error: 'Unable to update order.' }, { status: 500 });
  }
}
