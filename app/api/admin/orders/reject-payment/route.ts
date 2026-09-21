import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { requireAdminPermission } from '../../../../../lib/admin-access';
import { releasePaymentReservation } from '../../../../../lib/inventory-reservations';
import { notifyCustomer } from '../../../../../lib/email';

export async function POST(request: Request) {
  const admin = await requireAdminPermission('payments');
  if (!admin) return NextResponse.json({ error: 'Payments permission required.' }, { status: 403 });

  try {
    const body = await request.json();
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!/^ORD-\d{4}-\d{4,}$/.test(orderNumber) || !reason) {
      return NextResponse.json({ error: 'Order number and rejection reason are required.' }, { status: 400 });
    }

    const result = await db.$transaction(async tx => {
      const order = await tx.order.findUnique({
        where: { orderNumber },
        include: { items: true },
      });
      if (!order) throw new Error('NOT_FOUND');
      if (order.status !== 'PAYMENT_PENDING') throw new Error('INVALID_STATUS');
      if (!order.reservationExpiresAt || order.reservationExpiresAt <= new Date()) throw new Error('RESERVATION_EXPIRED');

      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          status: 'PAYMENT_PENDING',
          reservationExpiresAt: { gt: new Date() },
        },
        data: {
          status: 'CANCELLED',
          cancellationReason: reason,
          paymentRejectionReason: reason,
          reservationExpiresAt: null,
        },
      });
      if (claimed.count !== 1) throw new Error('INVALID_STATUS');

      await releasePaymentReservation(tx, order, 'PAYMENT_REJECTION_RELEASE');

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          oldStatus: 'PAYMENT_PENDING',
          newStatus: 'CANCELLED',
          changedBy: admin.email,
          note: `Payment rejected and reservation released: ${reason}`,
        },
      });

      return { orderNumber: order.orderNumber, status: 'CANCELLED' as const, email: order.email };
    });

    if (result.email) {
      void notifyCustomer(result.email, result.orderNumber, 'CANCELLED', 'Your payment could not be verified and the order was cancelled. Please contact support if you need help.');
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NOT_FOUND') return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    if (message === 'INVALID_STATUS') return NextResponse.json({ error: 'Order is no longer awaiting payment verification.' }, { status: 409 });
    if (message === 'RESERVATION_EXPIRED') return NextResponse.json({ error: 'This payment reservation has expired. The order has been cancelled and inventory released.' }, { status: 409 });
    console.error('payment rejection failed', error);
    return NextResponse.json({ error: 'Unable to reject payment.' }, { status: 500 });
  }
}
