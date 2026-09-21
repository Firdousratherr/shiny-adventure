import type { Prisma } from '@prisma/client';

export async function releaseExpiredPaymentReservations(tx: Prisma.TransactionClient) {
  const now = new Date();
  const expired = await tx.order.findMany({
    where: { status: 'PAYMENT_PENDING', reservationExpiresAt: { lt: now } },
    select: { id: true, orderNumber: true, items: { select: { productId: true, quantity: true, productName: true } } },
    take: 50,
  });

  for (const order of expired) {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: 'PAYMENT_PENDING', reservationExpiresAt: { lt: now } },
      data: { status: 'CANCELLED', cancellationReason: 'Payment reservation expired.', reservationExpiresAt: null },
    });
    if (claimed.count !== 1) continue;

    for (const item of order.items) {
      await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      await tx.inventoryMovement.create({
        data: { productId: item.productId, orderId: order.id, quantity: item.quantity, reason: 'PAYMENT_RESERVATION_EXPIRED' },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        oldStatus: 'PAYMENT_PENDING',
        newStatus: 'CANCELLED',
        changedBy: 'SYSTEM',
        note: 'Payment reservation expired and inventory was released.',
      },
    });
  }

  return expired.length;
}
