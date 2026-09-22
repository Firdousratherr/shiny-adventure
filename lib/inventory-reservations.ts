import type { Prisma } from '@prisma/client';
import { adjustInventoryBatch } from './inventory';

type ReservationOrder = {
  id: string;
  orderNumber: string;
  couponCode?: string | null;
  items: { productId: string; quantity: number; productName: string }[];
};

export async function releasePaymentReservation(
  tx: Prisma.TransactionClient,
  order: ReservationOrder,
  reason: string,
) {
  await adjustInventoryBatch(
    tx,
    order.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      orderId: order.id,
      reason,
    })),
  );

  if (order.couponCode) {
    await tx.coupon.updateMany({
      where: { code: order.couponCode, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }
}

export async function releaseExpiredPaymentReservations(tx: Prisma.TransactionClient) {
  const now = new Date();
  const expired = await tx.order.findMany({
    where: { status: 'PAYMENT_PENDING', reservationExpiresAt: { lt: now } },
    select: {
      id: true,
      orderNumber: true,
      couponCode: true,
      items: { select: { productId: true, quantity: true, productName: true } },
    },
    take: 50,
  });

  let released = 0;
  for (const order of expired) {
    const claimed = await tx.order.updateMany({
      where: {
        id: order.id,
        status: 'PAYMENT_PENDING',
        reservationExpiresAt: { lt: now },
      },
      data: {
        status: 'CANCELLED',
        cancellationReason: 'Payment reservation expired.',
        reservationExpiresAt: null,
      },
    });
    if (claimed.count !== 1) continue;

    await releasePaymentReservation(tx, order, 'PAYMENT_RESERVATION_EXPIRED');
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        oldStatus: 'PAYMENT_PENDING',
        newStatus: 'CANCELLED',
        changedBy: 'SYSTEM',
        note: 'Payment reservation expired; inventory and coupon usage were released.',
      },
    });
    released++;
  }

  return released;
}
