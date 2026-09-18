import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '../../../lib/db';
import { checkoutSchema } from '../../../lib/validation';
import { deliveryCharge, total } from '../../../lib/pricing';
import { rateLimit } from '../../../lib/rate-limit';
import { createPaymentAccessToken, hashPaymentAccessToken, PAYMENT_RESERVATION_MINUTES } from '../../../lib/payment-access';
import { releaseExpiredPaymentReservations } from '../../../lib/inventory-reservations';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const limited = await rateLimit(`checkout:${ip}`, 20, 600);
    if (limited.limited) return NextResponse.json({ error: 'Too many checkout attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': '600' } });

    const parsed = checkoutSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Please check your checkout details.', issues: parsed.error.flatten() }, { status: 400 });

    const data = parsed.data;
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
    const amount = total(subtotal, shipping);
    const paymentAccessToken = createPaymentAccessToken();
    const paymentAccessTokenHash = hashPaymentAccessToken(paymentAccessToken);
    const reservationExpiresAt = new Date(Date.now() + PAYMENT_RESERVATION_MINUTES * 60 * 1000);

    const order = await db.$transaction(async tx => {
      await releaseExpiredPaymentReservations(tx);

      // Reserve inventory atomically at order creation. Stock is reduced immediately and
      // returned only if payment expires/is cancelled. This prevents overselling.
      for (const [productId, quantity] of quantityByProduct) {
        const reserved = await tx.product.updateMany({
          where: { id: productId, status: 'ACTIVE', stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (reserved.count !== 1) {
          const product = byId.get(productId)!;
          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
        }
      }

      const counter = await tx.orderCounter.update({
        where: { id: 1 },
        data: { value: { increment: 1 } },
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

      for (const [productId, quantity] of quantityByProduct) {
        await tx.inventoryMovement.create({
          data: { productId, orderId: created.id, quantity: -quantity, reason: 'PAYMENT_RESERVATION' },
        });
      }

      return created;
    });

    return NextResponse.json({
      orderNumber: order.orderNumber,
      paymentToken: paymentAccessToken,
      totalAmount: amount.toFixed(2),
      deliveryCharge: shipping.toFixed(2),
      reservationExpiresAt: reservationExpiresAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('INSUFFICIENT_STOCK:')) {
      return NextResponse.json({ error: `${message.slice(19)} is no longer available in the requested quantity.` }, { status: 409 });
    }
    console.error('order creation failed', error);
    return NextResponse.json({ error: 'Unable to create your order right now.' }, { status: 500 });
  }
}
