import type { Prisma } from '@prisma/client';

type InventoryTx = Prisma.TransactionClient;

export type InventoryAdjustment = {
  productId: string;
  quantity: number;
  reason: string;
  orderId?: string | null;
};

export async function adjustInventory(
  tx: InventoryTx,
  adjustment: InventoryAdjustment,
) {
  if (!Number.isSafeInteger(adjustment.quantity) || adjustment.quantity === 0) {
    throw new Error('INVALID_INVENTORY_ADJUSTMENT');
  }

  const where =
    adjustment.quantity < 0
      ? { id: adjustment.productId, stock: { gte: Math.abs(adjustment.quantity) } }
      : { id: adjustment.productId };

  const result = await tx.product.updateMany({
    where,
    data: { stock: { increment: adjustment.quantity } },
  });

  if (result.count !== 1) {
    if (adjustment.quantity < 0) throw new Error('INSUFFICIENT_STOCK');
    throw new Error('PRODUCT_NOT_FOUND');
  }

  return tx.inventoryMovement.create({
    data: {
      productId: adjustment.productId,
      orderId: adjustment.orderId ?? null,
      quantity: adjustment.quantity,
      reason: adjustment.reason,
    },
  });
}

export async function adjustInventoryBatch(
  tx: InventoryTx,
  adjustments: InventoryAdjustment[],
) {
  for (const adjustment of adjustments) {
    await adjustInventory(tx, adjustment);
  }
}
