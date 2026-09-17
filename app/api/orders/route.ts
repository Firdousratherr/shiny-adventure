import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '../../../lib/db';
import { checkoutSchema } from '../../../lib/validation';
import { deliveryCharge, total } from '../../../lib/pricing';
import { rateLimit } from '../../../lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const limited = await rateLimit(`checkout:${ip}`, 20, 600); if (limited.limited) return NextResponse.json({ error: 'Too many checkout attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': '600' } });
    const parsed = checkoutSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Please check your checkout details.', issues: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data; const ids = Array.from(new Set(data.items.map(i => i.productId)));
    const products = await db.product.findMany({ where: { id: { in: ids }, status: 'ACTIVE' }, select: { id: true, name: true, sellingPrice: true, sourceCost: true, stock: true } });
    const byId = new Map(products.map(p => [p.id, p])); if (products.length !== ids.length) return NextResponse.json({ error: 'One or more products are no longer available.' }, { status: 409 });
    for (const item of data.items) { const p = byId.get(item.productId)!; if (item.quantity > p.stock) return NextResponse.json({ error: `${p.name} has only ${p.stock} available.` }, { status: 409 }); }
    const subtotal = data.items.reduce((sum, item) => sum.plus(byId.get(item.productId)!.sellingPrice.mul(item.quantity)), new Prisma.Decimal(0));
    const settings = await db.settings.findMany({ where: { key: { in: ['freeShippingThreshold', 'flatDeliveryCharge'] } } }); const values = Object.fromEntries(settings.map(s => [s.key, s.value]));
    const shipping = deliveryCharge(subtotal, values.freeShippingThreshold || '999', values.flatDeliveryCharge || '79'); const amount = total(subtotal, shipping);
    const order = await db.$transaction(async tx => { const counter = await tx.orderCounter.update({ where: { id: 1 }, data: { value: { increment: 1 } }, select: { value: true } }); const orderNumber = `ORD-${new Date().getFullYear()}-${String(counter.value).padStart(4, '0')}`; return tx.order.create({ data: { orderNumber, customerName: data.customerName, email: data.email || null, phone: data.phone, addressLine1: data.addressLine1, addressLine2: data.addressLine2 || null, landmark: data.landmark || null, city: data.city, district: data.district, state: data.state, pinCode: data.pinCode, totalAmount: amount, deliveryCharge: shipping, status: 'PAYMENT_PENDING', items: { create: data.items.map(item => { const p = byId.get(item.productId)!; return { productId: p.id, productName: p.name, quantity: item.quantity, unitPrice: p.sellingPrice, sourceCost: p.sourceCost }; }) }, history: { create: { oldStatus: null, newStatus: 'PAYMENT_PENDING', changedBy: 'SYSTEM', note: 'Order created; awaiting payment verification.' } } } }); });
    return NextResponse.json({ orderNumber: order.orderNumber, totalAmount: amount.toFixed(2), deliveryCharge: shipping.toFixed(2) }, { status: 201 });
  } catch (error) { console.error('order creation failed', error); return NextResponse.json({ error: 'Unable to create your order right now.' }, { status: 500 }); }
}
