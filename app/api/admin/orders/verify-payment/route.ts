import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { db } from '../../../../../lib/db';
import { notifyCustomer } from '../../../../../lib/email';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() : '';
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
    if (!orderNumber) return NextResponse.json({ error: 'Order number is required.' }, { status: 400 });
    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { orderNumber }, include: { items: true } });
      if (!order) throw new Error('NOT_FOUND');
      if (order.status !== 'PAYMENT_PENDING') throw new Error('INVALID_STATUS');
      if (!order.upiTransactionId || !order.paymentScreenshotUrl) throw new Error('PAYMENT_PROOF_MISSING');

      // Claim the payment transition before touching inventory. This makes two
      // simultaneous admin clicks mutually exclusive and prevents double deduction.
      const claimed = await tx.order.updateMany({ where: { id: order.id, status: 'PAYMENT_PENDING' }, data: { status: 'CONFIRMED', paymentVerifiedAt: new Date(), paymentVerifiedBy: session.user.email, paymentVerificationNote: note || null, paymentRejectionReason: null } });
      if (claimed.count !== 1) throw new Error('INVALID_STATUS');

      try {
        for (const item of order.items) {
          const updated = await tx.product.updateMany({ where: { id: item.productId, status: 'ACTIVE', stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
          if (updated.count !== 1) throw new Error(`INSUFFICIENT_STOCK:${item.productName}`);
        }
      } catch (error) {
        // Throwing rolls back the status claim and every stock decrement atomically.
        throw error;
      }

      await tx.orderStatusHistory.create({ data: { orderId: order.id, oldStatus: 'PAYMENT_PENDING', newStatus: 'CONFIRMED', changedBy: session.user.email, note: note || 'Payment manually verified; inventory deducted.' } });
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
