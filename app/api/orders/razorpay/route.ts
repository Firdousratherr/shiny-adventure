import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { getRazorpay } from '../../../../lib/razorpay';
import { rateLimit } from '../../../../lib/rate-limit';
import { verifyPaymentAccessToken } from '../../../../lib/payment-access';
import { releaseExpiredPaymentReservations } from '../../../../lib/inventory-reservations';

async function getSetting(key: string) {
  const setting = await db.settings.findUnique({ where: { key } });
  return setting?.value ?? '';
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const limited = await rateLimit(`razorpay-create:${ip}`, 20, 600);
    if (limited.limited) return NextResponse.json({ error: 'Too many payment attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': '600' } });

    const enabled = (await getSetting('razorpayEnabled')) === 'true';
    // The public Key ID must always match the Key Secret used by getRazorpay().
    // Prefer the Vercel environment variable so a stale admin setting cannot pair
    // one key ID with a different secret.
    const configuredKeyId = process.env.RAZORPAY_KEY_ID || await getSetting('razorpayKeyId');
    if (!enabled || !configuredKeyId) return NextResponse.json({ error: 'Razorpay payments are currently disabled.' }, { status: 403 });

    const body = await request.json();
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : '';
    const paymentToken = typeof body.paymentToken === 'string' ? body.paymentToken : '';
    if (!/^ORD-\d{4}-\d{4,}$/.test(orderNumber)) return NextResponse.json({ error: 'A valid order number is required.' }, { status: 400 });

    await db.$transaction(async tx => { await releaseExpiredPaymentReservations(tx); });

    const order = await db.order.findUnique({
      where: { orderNumber },
      select: { id: true, orderNumber: true, totalAmount: true, status: true, razorpayOrderId: true, reservationExpiresAt: true, paymentAccessTokenHash: true },
    });
    if (!order || !verifyPaymentAccessToken(paymentToken, order.paymentAccessTokenHash)) return NextResponse.json({ error: 'Invalid payment access token.' }, { status: 403 });
    if (order.status !== 'PAYMENT_PENDING') return NextResponse.json({ error: 'This order is no longer awaiting payment.' }, { status: 409 });
    if (!order.reservationExpiresAt || order.reservationExpiresAt <= new Date()) return NextResponse.json({ error: 'This payment session has expired. Please place a new order.' }, { status: 409 });

    if (order.razorpayOrderId) return NextResponse.json({ razorpayOrderId: order.razorpayOrderId, amount: Math.round(Number(order.totalAmount) * 100), currency: 'INR', keyId: configuredKeyId });

    const razorpay = getRazorpay();
    const amount = Math.round(Number(order.totalAmount) * 100);
    const rpOrder = await razorpay.orders.create({ amount, currency: 'INR', receipt: order.orderNumber, notes: { zenvoraOrderId: order.id } });
    const saved = await db.order.updateMany({
      where: { id: order.id, status: 'PAYMENT_PENDING', paymentAccessTokenHash: order.paymentAccessTokenHash, reservationExpiresAt: { gt: new Date() }, razorpayOrderId: null },
      data: { razorpayOrderId: rpOrder.id, paymentMethod: 'RAZORPAY' },
    });
    if (saved.count !== 1) {
      const current = await db.order.findUnique({ where: { id: order.id }, select: { razorpayOrderId: true, status: true } });
      if (current?.razorpayOrderId) return NextResponse.json({ razorpayOrderId: current.razorpayOrderId, amount, currency: 'INR', keyId: configuredKeyId });
      return NextResponse.json({ error: 'Payment initialization conflicted with another attempt or the reservation expired.' }, { status: 409 });
    }
    return NextResponse.json({ razorpayOrderId: rpOrder.id, amount: rpOrder.amount, currency: rpOrder.currency, keyId: configuredKeyId });
  } catch (error) {
    if (error instanceof Error && error.message === 'RAZORPAY_NOT_CONFIGURED') return NextResponse.json({ error: 'Razorpay is not configured. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel.' }, { status: 503 });
    console.error('razorpay order creation failed', error);
    return NextResponse.json({ error: 'Unable to start Razorpay payment.' }, { status: 500 });
  }
}
