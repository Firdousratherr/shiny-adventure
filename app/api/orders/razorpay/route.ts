import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { getRazorpay } from '../../../../lib/razorpay';
import { rateLimit } from '../../../../lib/rate-limit';

async function getSetting(key: string) { const setting = await db.settings.findUnique({ where: { key } }); return setting?.value ?? ''; }
export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const limited = await rateLimit(`razorpay-create:${ip}`, 20, 600); if (limited.limited) return NextResponse.json({ error: 'Too many payment attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': '600' } });
    const enabled = (await getSetting('razorpayEnabled')) === 'true'; const configuredKeyId = await getSetting('razorpayKeyId');
    if (!enabled || !configuredKeyId) return NextResponse.json({ error: 'Razorpay payments are currently disabled.' }, { status: 403 });
    const { orderNumber } = await request.json(); if (typeof orderNumber !== 'string' || !/^ORD-\d{4}-\d{4,}$/i.test(orderNumber.trim())) return NextResponse.json({ error: 'A valid order number is required.' }, { status: 400 });
    const normalizedOrderNumber = orderNumber.trim().toUpperCase(); const order = await db.order.findUnique({ where: { orderNumber: normalizedOrderNumber }, select: { id: true, orderNumber: true, totalAmount: true, status: true, razorpayOrderId: true } });
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 }); if (order.status !== 'PAYMENT_PENDING') return NextResponse.json({ error: 'This order is no longer awaiting payment.' }, { status: 409 });
    if (order.razorpayOrderId) return NextResponse.json({ razorpayOrderId: order.razorpayOrderId, amount: Math.round(Number(order.totalAmount) * 100), currency: 'INR', keyId: configuredKeyId });
    const razorpay = getRazorpay(); const amount = Math.round(Number(order.totalAmount) * 100); const rpOrder = await razorpay.orders.create({ amount, currency: 'INR', receipt: order.orderNumber, notes: { zenvoraOrderId: order.id } });
    const saved = await db.order.updateMany({ where: { id: order.id, status: 'PAYMENT_PENDING', razorpayOrderId: null }, data: { razorpayOrderId: rpOrder.id, paymentMethod: 'RAZORPAY' } });
    if (saved.count !== 1) { const current = await db.order.findUnique({ where: { id: order.id }, select: { razorpayOrderId: true } }); if (current?.razorpayOrderId) return NextResponse.json({ razorpayOrderId: current.razorpayOrderId, amount, currency: 'INR', keyId: configuredKeyId }); return NextResponse.json({ error: 'Payment initialization conflicted with another attempt.' }, { status: 409 }); }
    return NextResponse.json({ razorpayOrderId: rpOrder.id, amount: rpOrder.amount, currency: rpOrder.currency, keyId: configuredKeyId });
  } catch (error) { if (error instanceof Error && error.message === 'RAZORPAY_NOT_CONFIGURED') return NextResponse.json({ error: 'Razorpay is not configured.' }, { status: 503 }); console.error('razorpay order creation failed', error); return NextResponse.json({ error: 'Unable to start Razorpay payment.' }, { status: 500 }); }
}
