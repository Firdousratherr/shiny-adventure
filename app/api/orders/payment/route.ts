import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { db } from '../../../../lib/db';
import { paymentSchema } from '../../../../lib/validation';
import { rateLimit } from '../../../../lib/rate-limit';
import { verifyPaymentAccessToken } from '../../../../lib/payment-access';
import { releaseExpiredPaymentReservations } from '../../../../lib/inventory-reservations';

const MAX_BYTES = 5 * 1024 * 1024;

function matchesMagicBytes(type: string, bytes: Uint8Array) {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.length >= 8 && bytes.slice(0, 8).every((b, i) => b === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][i]);
  if (type === 'image/webp') return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  return false;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const limited = await rateLimit(`payment-proof:${ip}`, 10, 600);
    if (limited.limited) return NextResponse.json({ error: 'Too many payment submissions. Please try again later.' }, { status: 429, headers: { 'Retry-After': '600' } });

    const fd = await request.formData();
    const parsed = paymentSchema.safeParse({ orderNumber: String(fd.get('orderNumber') || ''), upiTransactionId: String(fd.get('upiTransactionId') || '') });
    const paymentToken = String(fd.get('paymentToken') || '');
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payment details.' }, { status: 400 });
    const file = fd.get('screenshot');
    if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ error: 'Invalid screenshot. Use JPG, PNG or WebP up to 5 MB.' }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesMagicBytes(file.type, bytes)) return NextResponse.json({ error: 'The uploaded file is not a valid image.' }, { status: 400 });

    await db.$transaction(async tx => { await releaseExpiredPaymentReservations(tx); });
    const order = await db.order.findUnique({ where: { orderNumber: parsed.data.orderNumber }, select: { id: true, status: true, reservationExpiresAt: true, paymentAccessTokenHash: true } });
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    if (!verifyPaymentAccessToken(paymentToken, order.paymentAccessTokenHash)) return NextResponse.json({ error: 'Invalid payment access token.' }, { status: 403 });
    if (order.status !== 'PAYMENT_PENDING') return NextResponse.json({ error: 'This order is not awaiting payment.' }, { status: 409 });
    if (!order.reservationExpiresAt || order.reservationExpiresAt <= new Date()) return NextResponse.json({ error: 'This payment session has expired. Please place a new order.' }, { status: 409 });
    const duplicate = await db.order.findUnique({ where: { upiTransactionId: parsed.data.upiTransactionId }, select: { id: true } });
    if (duplicate) return NextResponse.json({ error: 'This UTR has already been submitted.' }, { status: 409 });

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const blob = await put(`payments/${order.id}-${crypto.randomUUID()}.${ext}`, new Blob([bytes], { type: file.type }), { access: 'private', contentType: file.type });
    try {
      const saved = await db.order.updateMany({ where: { id: order.id, status: 'PAYMENT_PENDING', paymentAccessTokenHash: order.paymentAccessTokenHash, reservationExpiresAt: { gt: new Date() } }, data: { upiTransactionId: parsed.data.upiTransactionId, paymentScreenshotUrl: blob.url } });
      if (saved.count !== 1) throw new Error('PAYMENT_SESSION_EXPIRED');
    } catch (error) {
      if (error instanceof Error && error.message === 'PAYMENT_SESSION_EXPIRED') {
        try { await del(blob.url); } catch (cleanupError) { console.error('payment proof cleanup failed', cleanupError); }
        return NextResponse.json({ error: 'This payment session has expired. Please place a new order.' }, { status: 409 });
      }
      console.error('payment proof database update failed', error);
      try { await del(blob.url); } catch (cleanupError) { console.error('payment proof cleanup failed', cleanupError); }
      return NextResponse.json({ error: 'Unable to save payment details right now.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) { console.error('payment submission failed', error); return NextResponse.json({ error: 'Unable to submit payment details right now.' }, { status: 500 }); }
}
