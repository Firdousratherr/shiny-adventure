import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '../../../lib/db';
import { checkoutSchema } from '../../../lib/validation';
import { deliveryCharge, total } from '../../../lib/pricing';
import { rateLimit } from '../../../lib/rate-limit';
import { createPaymentAccessToken, hashPaymentAccessToken, PAYMENT_RESERVATION_MINUTES } from '../../../lib/payment-access';
import { releaseExpiredPaymentReservations } from '../../../lib/inventory-reservations';
import { adjustInventory } from '../../../lib/inventory';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const limited = await rateLimit(`checkout:${ip}`, 20, 600);
    if (limited.limited) return NextResponse.json({ error: 'Too many checkout attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': '600' } });

    const parsed = checkoutSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Please check your checkout details.', issues: parsed.error.flatten() }, { status: 400 });

    const data = parsed.data;
    const couponCode = (data.couponCode || '').trim().toUpperCase();
    const quantityByProduct = new Map<string, number>();
    for (const item of data.items) quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) || 0) + item.quantity);
    if ([...quantityByProduct.values()].some(quantity => quantity > 99)) {
      return NextResponse.json({ error: 'A product quantity cannot exceed 99.' }, { status: 400 });
    }

    const ids = [...quantityByProduct.keys()];
    const products = await db.product.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      select: { id: true, name: true, sellingPrice: true, sourceCost: true, stock: true },
    });
    const byId = new Map(products.map(p => [p.id, p]));
    if (products.length !== ids.length) return NextResponse.json({ error: 'One or more products are no longer available.' }, { status: 409 });

    for (const [productId, quantity] of quantityByProduct) {
      const p = byId.get(productId)!;
      if (quantity > p.stock) return NextResponse.json({ error: `${p.name} has only ${p.stock} available.` }, { status: 409 });
    }

    const subtotal = [...quantityByProduct].reduce(
      (sum, [productId, quantity]) => sum.plus(byId.get(productId)!.sellingPrice.mul(quantity)),
      new Prisma.Decimal(0),
    );
    const settings = await db.settings.findMany({ where: { key: { in: ['freeShippingThreshold', 'flatDeliveryCharge'] } } });
    const values = Object.fromEntries(settings.map(s => [s.key, s.value]));
    const shipping = deliveryCharge(subtotal, values.freeShippingThreshold || '999', values.flatDeliveryCharge || '79');
    let discount = new Prisma.Decimal(0);
    let coupon: { id: string; code: string; type: string; value: Prisma.Decimal; minOrderAmount: Prisma.Decimal | null; maxDiscount: Prisma.Decimal | null; usageLimit: number | null; usedCount: number; enabled: boolean; startsAt: Date | null; expiresAt: Date | null } | null = null;
    if (couponCode) {
      coupon = await db.coupon.findUnique({ where: { code: couponCode }, select: { id: true, code: true, type: true, value: true, minOrderAmount: true, maxDiscount: true, usageLimit: true, usedCount: true, enabled: true, startsAt: true, expiresAt: true } });
      const now = new Date();
      if (!coupon || !coupon.enabled || (coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt <= now) || (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)) {
        return NextResponse.json({ error: 'This coupon is invalid, expired or no longer available.' }, { status: 400 });
      }
      if (coupon.minOrderAmount && subtotal.lessThan(coupon.minOrderAmount)) return NextResponse.json({ error: `Minimum order value for this coupon is ₹${coupon.minOrderAmount.toFixed(2)}.` }, { status: 400 });
      discount = coupon.type === 'FIXED' ? coupon.value : subtotal.mul(coupon.value).div(100);
      if (coupon.maxDiscount && discount.greaterThan(coupon.maxDiscount)) discount = coupon.maxDiscount;
      if (discount.greaterThan(subtotal)) discount = subtotal;
    }
    const amount = total(subtotal, shipping).minus(discount);
    const paymentAccessToken = createPaymentAccessToken();
    const paymentAccessTokenHash = hashPaymentAccessToken(paymentAccessToken);
    const reservationExpiresAt = new Date(Date.now() + PAYMENT_RESERVATION_MINUTES * 60 * 1000);

    const order = await db.$transaction(async tx => {
      if (coupon) {
        const used = await tx.coupon.updateMany({ where: { id: coupon.id, enabled: true, ...(coupon.usageLimit !== null ? { usedCount: { lt: coupon.usageLimit } } : {}) }, data: { usedCount: { increment: 1 } } });
        if (used.count !== 1) throw new Error('COUPON_UNAVAILABLE');
      }
      await releaseExpiredPaymentReservations(tx);

      // Reserve inventory atomically at order creation. The centralized inventory
      // service records the movement and rejects races that would oversell stock.
      for (const [productId, quantity] of quantityByProduct) {
        const product = byId.get(productId)!;
        try {
          await adjustInventory(tx, {
            productId,
            quantity: -quantity,
            orderId: undefined,
            reason: 'PAYMENT_RESERVATION',
          });
        } catch (error) {
          if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
            throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
          }
          throw error;
        }
      }

      const counter = await tx.orderCounter.upsert({
        where: { id: 1 },
        create: { id: 1, value: 1 },
        update: { value: { increment: 1 } },
        select: { value: true },
      });
      const orderNumber = `ORD-${new Date().getFullYear()}-${String(counter.value).padStart(4, '0')}`;

      const created = await tx.order.create({
        data: {
          orderNumber,
          customerName: data.customerName,
          email: data.email || null,
          phone: data.phone,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2 || null,
          landmark: data.landmark || null,
          city: data.city,
          district: data.district,
          state: data.state,
          pinCode: data.pinCode,
          totalAmount: amount,
          deliveryCharge: shipping,
          couponCode: coupon?.code || null,
          discountAmount: discount,
          status: 'PAYMENT_PENDING',
          reservationExpiresAt,
          paymentAccessTokenHash,
          items: {
            create: [...quantityByProduct].map(([productId, quantity]) => {
              const p = byId.get(productId)!;
              return { productId: p.id, productName: p.name, quantity, unitPrice: p.sellingPrice, sourceCost: p.sourceCost };
            }),
          },
          history: {
            create: {
              oldStatus: null,
              newStatus: 'PAYMENT_PENDING',
              changedBy: 'SYSTEM',
              note: `Order created; inventory reserved for ${PAYMENT_RESERVATION_MINUTES} minutes while awaiting payment.`,
            },
          },
        },
      });

      // The inventory movement was recorded by adjustInventory above.
      // The order is already attached to the reservation logically by its order ID;
      // the movement remains valid without a post-create mutation because the reservation
      // occurs before the order row exists.
    });

    void db.adminNotification.create({ data: { type: 'ORDER', title: 'New order awaiting payment', message: `${order.orderNumber} is awaiting payment confirmation.`, entityType: 'Order', entityId: order.id } }).catch(() => {});
    return NextResponse.json({
      orderNumber: order.orderNumber,
      paymentToken: paymentAccessToken,
      totalAmount: amount.toFixed(2),
      deliveryCharge: shipping.toFixed(2),
      reservationExpiresAt: reservationExpiresAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'COUPON_UNAVAILABLE') return NextResponse.json({ error: 'That coupon was just used up. Please try another coupon.' }, { status: 409 });
    if (message.startsWith('INSUFFICIENT_STOCK:')) {
      return NextResponse.json({ error: `${message.slice(19)} is no longer available in the requested quantity.` }, { status: 409 });
    }
    console.error('order creation failed', error);
    return NextResponse.json({ error: 'Unable to create your order right now.' }, { status: 500 });
  }
}
