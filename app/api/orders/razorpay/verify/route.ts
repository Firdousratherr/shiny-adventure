import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { getRazorpay, verifyCheckoutSignature } from '../../../../../lib/razorpay';
import { notifyCustomer } from '../../../../../lib/email';
import { rateLimit } from '../../../../../lib/rate-limit';
import { verifyPaymentAccessToken } from '../../../../../lib/payment-access';
import { releaseExpiredPaymentReservations } from '../../../../../lib/inventory-reservations';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const limited = await rateLimit(`razorpay-verify:${ip}`, 20, 600);
    if (limited.limited) return NextResponse.json({ error: 'Too many payment verification attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': '600' } });

    const body = await request.json();
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : '';
    const paymentToken = typeof body.paymentToken === 'string' ? body.paymentToken : '';
    const paymentId = typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : '';
    const razorpayOrderId = typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : '';
    const signature = typeof body.razorpay_signature === 'string' ? body.razorpay_signature : '';

    if (!/^ORD-\d{4}-\d{4,}$/.test(orderNumber) || !paymentId || !razorpayOrderId || !signature) {
      return NextResponse.json({ error: 'Incomplete Razorpay response.' }, { status: 400 });
    }

    await db.$transaction(async tx => { await releaseExpiredPaymentReservations(tx); });

    const order = await db.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });

    if (!order || !verifyPaymentAccessToken(paymentToken, order.paymentAccessTokenHash)) {
      return NextResponse.json({ error: 'Invalid payment access token.' }, { status: 403 });
    }
    if (order.razorpayOrderId !== razorpayOrderId) return NextResponse.json({ error: 'Razorpay order mismatch.' }, { status: 400 });
    if (order.status !== 'PAYMENT_PENDING') return NextResponse.json({ error: 'Order is already processed.' }, { status: 409 });
    if (!order.reservationExpiresAt || order.reservationExpiresAt <= new Date()) {
      return NextResponse.json({ error: 'This payment session has expired. Please place a new order.' }, { status: 409 });
    }
    if (!verifyCheckoutSignature(razorpayOrderId, paymentId, signature)) {
      return NextResponse.json({ error: 'Payment signature verification failed.' }, { status: 400 });
    }

    const razorpay = getRazorpay();
    const payment = await razorpay.payments.fetch(paymentId);

    if (payment.order_id !== razorpayOrderId) {
      return NextResponse.json({ error: 'Razorpay payment does not belong to this order.' }, { status: 400 });
    }
    if (Number(payment.amount) !== Math.round(Number(order.totalAmount) * 100)) {
      return NextResponse.json({ error: 'Razorpay payment amount does not match the order.' }, { status: 400 });
    }

    // Auto-capture is normally configured in Razorpay. If a payment is only
    // authorized, capture it server-side so a successful checkout is not left
    // stuck in PAYMENT_PENDING.
    let finalPayment = payment;
    if (payment.status === 'authorized') {
      finalPayment = await razorpay.payments.capture(paymentId, Math.round(Number(order.totalAmount) * 100), 'INR');
    }

    if (finalPayment.status !== 'captured') {
      const detail = finalPayment.error_description || finalPayment.error_reason || finalPayment.status || 'unknown status';
      console.error('razorpay payment not captured', {
        orderNumber,
        razorpayOrderId,
        paymentId,
        status: finalPayment.status,
        error: detail,
      });
      return NextResponse.json({ error: `Razorpay payment is not captured yet: ${detail}` }, { status: 409 });
    }

    const result = await db.$transaction(async tx => {
      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          status: 'PAYMENT_PENDING',
          paymentAccessTokenHash: order.paymentAccessTokenHash,
          reservationExpiresAt: { gt: new Date() },
        },
        data: {
          status: 'CONFIRMED',
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
          paymentMethod: 'RAZORPAY',
          paymentVerifiedAt: new Date(),
          paymentVerifiedBy: 'RAZORPAY',
          paymentVerificationNote: 'Razorpay payment captured and verified server-side.',
          paymentRejectionReason: null,
          reservationExpiresAt: null,
        },
      });

      if (claimed.count !== 1) throw new Error('ALREADY_PROCESSED');

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          oldStatus: 'PAYMENT_PENDING',
          newStatus: 'CONFIRMED',
          changedBy: 'RAZORPAY',
          note: 'Razorpay payment captured and verified server-side; existing inventory reservation converted to a confirmed sale.',
        },
      });

      return { orderNumber: order.orderNumber, email: order.email };
    });

    if (result.email) {
      void notifyCustomer(result.email, result.orderNumber, 'CONFIRMED', 'Your Razorpay payment has been verified and your order is being prepared.');
    }

    return NextResponse.json({ ok: true, orderNumber: result.orderNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'ALREADY_PROCESSED') return NextResponse.json({ error: 'Order is already processed.' }, { status: 409 });
    if (message === 'RAZORPAY_NOT_CONFIGURED') return NextResponse.json({ error: 'Razorpay is not configured.' }, { status: 503 });

    console.error('razorpay verification failed', error);
    return NextResponse.json({ error: 'Unable to verify Razorpay payment.' }, { status: 500 });
  }
}
