import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { db } from '../../../../../lib/db';
import { notifyCustomer } from '../../../../../lib/email';

export async function POST(request: Request) {
  const session = await auth();
  const adminEmail = session?.user?.role === 'admin' ? session.user.email : null;
  if (!adminEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : '';
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
    if (!/^ORD-\d{4}-\d{4,}$/.test(orderNumber)) return NextResponse.json({ error: 'Invalid order number.' }, { status: 400 });
    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { orderNumber }, include: { items: true } });
      if (!order) throw new Error('NOT_FOUND');
      if (order.status !== 'PAYMENT_PENDING') throw new Error('INVALID_STATUS');
      if (!order.upiTransactionId || !order.paymentScreenshotUrl) throw new Error('PAYMENT_PROOF_MISSING');

      const claimed = await tx.order.updateMany({ where: { id: order.id, status: 'PAYMENT_PENDING' }, data: { status: 'CONFIRMED', paymentVerifiedAt: new Date(), paymentVerifiedBy: adminEmail, paymentVerificationNote: note || null, paymentRejectionReason: null } });
      if (claimed.count !== 1) throw new Error('INVALID_STATUS');

      for (const item of order.items) {
        const updated = await tx.product.updateMany({ where: { id: item.productId, status: 'ACTIVE', stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
        if (updated.count !== 1) throw new Error(`INSUFFICIENT_STOCK:${item.productName}`);
        await tx.inventoryMovement.create({ data: { productId: item.productId, orderId: order.id, quantity: -item.quantity, reason: 'PAYMENT_CONFIRMED_DEDUCTION' } });
      }

      await tx.orderStatusHistory.create({ data: { orderId: order.id, oldStatus: 'PAYMENT_PENDING', newStatus: 'CONFIRMED', changedBy: adminEmail, note: note || 'Payment manually verified; inventory deducted.' } });
      return { orderNumber: order.orderNumber, status: 'CONFIRMED' as const, email: order.email };
    });
    if (result.email) void notifyCustomer(result.email, result.orderNumber, 'CONFIRMED', 'Your payment has been verified and your order is being prepared.');
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NOT_FOUND') return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    if (message === 'INVALID_STATUS') return NextResponse.json({ error: 'Order is not awaiting payment verification.' }, { status: 409 });
    if (message === 'PAYMENT_PROOF_MISSING') return NextResponse.json({ error: 'UTR and payment screenshot are required before verification.' }, { status: 409 });
    if (message.startsWith('INSUFFICIENT_STOCK:')) return NextResponse.json({ error: `${message.slice(19)} does not have enough stock.` }, { status: 409 });
    console.error('payment verification failed', error);
    return NextResponse.json({ error: 'Unable to verify payment.' }, { status: 500 });
  }
}
