import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { verifyCheckoutSignature } from '../../../../../lib/razorpay';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber : '';
    const paymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : '';
    const razorpayOrderId = typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : '';
    const signature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature : '';
    if (!orderNumber || !paymentId || !razorpayOrderId || !signature) return NextResponse.json({ error: 'Incomplete Razorpay response.' }, { status: 400 });
    const order = await db.order.findUnique({ where: { orderNumber }, select: { id: true, status: true, totalAmount: true, razorpayOrderId: true } });
    if (!order || order.razorpayOrderId !== razorpayOrderId) return NextResponse.json({ error: 'Razorpay order mismatch.' }, { status: 400 });
    if (order.status !== 'PAYMENT_PENDING') return NextResponse.json({ error: 'Order is already processed.' }, { status: 409 });
    if (!verifyCheckoutSignature(razorpayOrderId, paymentId, signature)) return NextResponse.json({ error: 'Payment signature verification failed.' }, { status: 400 });
    await db.order.update({ where: { id: order.id }, data: { razorpayPaymentId: paymentId, razorpaySignature: signature, paymentMethod: 'RAZORPAY' } });
    return NextResponse.json({ ok: true, orderNumber });
  } catch (error) { console.error('razorpay verification failed', error); return NextResponse.json({ error: 'Unable to verify Razorpay payment.' }, { status: 500 }); }
}
