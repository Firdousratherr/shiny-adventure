import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { db } from '../../../../lib/db';
import { paymentSchema } from '../../../../lib/validation';
import { rateLimit } from '../../../../lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const limited = await rateLimit(`payment-proof:${ip}`, 10, 600);
    if (limited.limited) return NextResponse.json({ error: 'Too many payment submissions. Please try again later.' }, { status: 429, headers: { 'Retry-After': '600' } });

    const fd = await request.formData();
    const parsed = paymentSchema.safeParse({ orderNumber: String(fd.get('orderNumber') || ''), upiTransactionId: String(fd.get('upiTransactionId') || '') });
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payment details.' }, { status: 400 });
    const file = fd.get('screenshot');
    if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Invalid screenshot. Use JPG, PNG or WebP up to 5 MB.' }, { status: 400 });
    const order = await db.order.findUnique({ where: { orderNumber: parsed.data.orderNumber }, select: { id: true, status: true } });
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    if (order.status !== 'PAYMENT_PENDING') return NextResponse.json({ error: 'This order is not awaiting payment.' }, { status: 409 });
    const duplicate = await db.order.findUnique({ where: { upiTransactionId: parsed.data.upiTransactionId }, select: { id: true } });
    if (duplicate) return NextResponse.json({ error: 'This UTR has already been submitted.' }, { status: 409 });
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const blob = await put(`payments/${order.id}-${crypto.randomUUID()}.${ext}`, file, { access: 'private', contentType: file.type });
    try {
      await db.order.update({ where: { id: order.id }, data: { upiTransactionId: parsed.data.upiTransactionId, paymentScreenshotUrl: blob.url } });
    } catch (error) {
      // Avoid leaving an uploaded proof referenced by no order if the DB update fails.
      console.error('payment proof database update failed', error);
      return NextResponse.json({ error: 'Unable to save payment details right now.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) { console.error('payment submission failed', error); return NextResponse.json({ error: 'Unable to submit payment details right now.' }, { status: 500 }); }
}
