import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { getRazorpay } from '../../../../lib/razorpay';

export async function POST(request: Request) {
  try {
    if (process.env.RAZORPAY_ENABLED !== 'true') return NextResponse.json({ error: 'Razorpay payments are currently disabled.' }, { status: 403 });
    const { orderNumber } = await request.json();
    if (typeof orderNumber !== 'string' || !orderNumber) return NextResponse.json({ error: 'Order number is required.' }, { status: 400 });
    const order = await db.order.findUnique({ where: { orderNumber }, select: { id: true, orderNumber: true, totalAmount: true, status: true, razorpayOrderId: true } });
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    if (order.status !== 'PAYMENT_PENDING') return NextResponse.json({ error: 'This order is no longer awaiting payment.' }, { status: 409 });
    if (order.razorpayOrderId) return NextResponse.json({ razorpayOrderId: order.razorpayOrderId, amount: Number(order.totalAmount) * 100, currency: 'INR' });
    const razorpay = getRazorpay();
    const rpOrder = await razorpay.orders.create({ amount: Math.round(Number(order.totalAmount) * 100), currency: 'INR', receipt: order.orderNumber, notes: { zenvoraOrderId: order.id } });
    await db.order.update({ where: { id: order.id }, data: { razorpayOrderId: rpOrder.id, paymentMethod: 'RAZORPAY' } });
    return NextResponse.json({ razorpayOrderId: rpOrder.id, amount: rpOrder.amount, currency: rpOrder.currency });
  } catch (error) {
    if (error instanceof Error && error.message === 'RAZORPAY_NOT_CONFIGURED') return NextResponse.json({ error: 'Razorpay is not configured.' }, { status: 503 });
    console.error('razorpay order creation failed', error);
    return NextResponse.json({ error: 'Unable to start Razorpay payment.' }, { status: 500 });
  }
}
