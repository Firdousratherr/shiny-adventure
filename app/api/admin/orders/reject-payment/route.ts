import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { db } from '../../../../../lib/db';

export async function POST(request: Request) {
  const session = await auth();
  const adminEmail = session?.user?.email;
  if (!adminEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!orderNumber || !reason) return NextResponse.json({ error: 'Order number and rejection reason are required.' }, { status: 400 });
    const order = await db.order.findUnique({ where: { orderNumber }, select: { id: true, status: true } });
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    if (order.status !== 'PAYMENT_PENDING') return NextResponse.json({ error: 'Only payment-pending orders can be rejected.' }, { status: 409 });
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.order.update({ where: { id: order.id }, data: { paymentRejectionReason: reason }, select: { orderNumber: true, status: true, paymentRejectionReason: true } });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, oldStatus: 'PAYMENT_PENDING', newStatus: 'PAYMENT_PENDING', changedBy: adminEmail, note: `Payment rejected: ${reason}` } });
      return result;
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('payment rejection failed', error);
    return NextResponse.json({ error: 'Unable to reject payment.' }, { status: 500 });
  }
}
