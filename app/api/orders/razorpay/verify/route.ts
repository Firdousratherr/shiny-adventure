import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { getRazorpay, verifyCheckoutSignature } from '../../../../../lib/razorpay';
import { notifyCustomer } from '../../../../../lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() : '';
    const paymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : '';
    const razorpayOrderId = typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : '';
    const signature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature : '';
    if (!orderNumber || !paymentId || !razorpayOrderId || !signature) return NextResponse.json({ error: 'Incomplete Razorpay response.' }, { status: 400 });
    const order = await db.order.findUnique({ where: { orderNumber }, include: { items: true } });
    if (!order || order.razorpayOrderId !== razorpayOrderId) return NextResponse.json({ error: 'Razorpay order mismatch.' }, { status: 400 });
    if (order.status !== 'PAYMENT_PENDING') return NextResponse.json({ error: 'Order is already processed.' }, { status: 409 });
    if (!verifyCheckoutSignature(razorpayOrderId, paymentId, signature)) return NextResponse.json({ error: 'Payment signature verification failed.' }, { status: 400 });
    const payment = await getRazorpay().payments.fetch(paymentId);
    if (payment.order_id !== razorpayOrderId || payment.status !== 'captured' || Number(payment.amount) !== Math.round(Number(order.totalAmount) * 100)) return NextResponse.json({ error: 'Razorpay payment is not captured for the expected amount.' }, { status: 400 });

    const result = await db.$transaction(async tx => {
      // Claim first so concurrent browser verification and webhook delivery cannot
      // both deduct inventory for the same payment.
      const claimed = await tx.order.updateMany({ where: { id: order.id, status: 'PAYMENT_PENDING' }, data: { status: 'CONFIRMED', razorpayPaymentId: paymentId, razorpaySignature: signature, paymentMethod: 'RAZORPAY', paymentVerifiedAt: new Date(), paymentVerifiedBy: 'RAZORPAY', paymentVerificationNote: 'Razorpay payment captured and verified server-side.', paymentRejectionReason: null } });
      if (claimed.count !== 1) throw new Error('ALREADY_PROCESSED');
      for (const item of order.items) {
        const updated = await tx.product.updateMany({ where: { id: item.productId, status: 'ACTIVE', stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
        if (updated.count !== 1) throw new Error(`INSUFFICIENT_STOCK:${item.productName}`);
      }
      await tx.orderStatusHistory.create({ data: { orderId: order.id, oldStatus: 'PAYMENT_PENDING', newStatus: 'CONFIRMED', changedBy: 'RAZORPAY', note: 'Razorpay payment captured and inventory deducted.' } });
      return { orderNumber: order.orderNumber, status: 'CONFIRMED' as const, email: order.email };
    });
    if (result.email) void notifyCustomer(result.email, result.orderNumber, 'CONFIRMED', 'Your Razorpay payment has been verified and your order is being prepared.');
    return NextResponse.json({ ok: true, orderNumber: result.orderNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'ALREADY_PROCESSED') return NextResponse.json({ error: 'Order is already processed.' }, { status: 409 });
    if (message === 'RAZORPAY_NOT_CONFIGURED') return NextResponse.json({ error: 'Razorpay is not configured.' }, { status: 503 });
    if (message.startsWith('INSUFFICIENT_STOCK:')) return NextResponse.json({ error: `${message.slice(19)} does not have enough stock.` }, { status: 409 });
    console.error('razorpay verification failed', error); return NextResponse.json({ error: 'Unable to verify Razorpay payment.' }, { status: 500 });
  }
}
