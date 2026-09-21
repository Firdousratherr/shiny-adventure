import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { notifyCustomer } from '../../../../../lib/email';
import { releaseExpiredPaymentReservations } from '../../../../../lib/inventory-reservations';
import { requireAdminPermission } from '../../../../../lib/admin-access';

export async function POST(request: Request) {
  const admin = await requireAdminPermission('payments');
  const adminEmail = admin?.email || null;
  if (!adminEmail) return NextResponse.json({ error: 'Payments permission required.' }, { status: 403 });

  try {
    const body = await request.json();
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : '';
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
    if (!/^ORD-\d{4}-\d{4,}$/.test(orderNumber)) return NextResponse.json({ error: 'Invalid order number.' }, { status: 400 });

    await db.$transaction(async tx => { await releaseExpiredPaymentReservations(tx); });

    const result = await db.$transaction(async tx => {
      const order = await tx.order.findUnique({ where: { orderNumber }, include: { items: true } });
      if (!order) throw new Error('NOT_FOUND');
      if (order.status !== 'PAYMENT_PENDING') throw new Error('INVALID_STATUS');
      if (!order.reservationExpiresAt || order.reservationExpiresAt <= new Date()) throw new Error('RESERVATION_EXPIRED');
      if (!order.upiTransactionId || !order.paymentScreenshotUrl) throw new Error('PAYMENT_PROOF_MISSING');

      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: 'PAYMENT_PENDING', reservationExpiresAt: { gt: new Date() } },
        data: {
          status: 'CONFIRMED',
          paymentVerifiedAt: new Date(),
          paymentVerifiedBy: adminEmail,
          paymentVerificationNote: note || null,
          paymentRejectionReason: null,
          reservationExpiresAt: null,
        },
      });
      if (claimed.count !== 1) throw new Error('INVALID_STATUS');

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          oldStatus: 'PAYMENT_PENDING',
          newStatus: 'CONFIRMED',
          changedBy: adminEmail,
          note: note || 'Payment manually verified; existing inventory reservation converted to a confirmed sale.',
        },
      });
      return { orderNumber: order.orderNumber, status: 'CONFIRMED' as const, email: order.email };
    });

    if (result.email) void notifyCustomer(result.email, result.orderNumber, 'CONFIRMED', 'Your payment has been verified and your order is being prepared.');
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NOT_FOUND') return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    if (message === 'INVALID_STATUS') return NextResponse.json({ error: 'Order is not awaiting payment verification.' }, { status: 409 });
    if (message === 'RESERVATION_EXPIRED') return NextResponse.json({ error: 'This payment reservation has expired. The order has been cancelled and inventory released.' }, { status: 409 });
    if (message === 'PAYMENT_PROOF_MISSING') return NextResponse.json({ error: 'UTR and payment screenshot are required before verification.' }, { status: 409 });
    console.error('payment verification failed', error);
    return NextResponse.json({ error: 'Unable to verify payment.' }, { status: 500 });
  }
}
