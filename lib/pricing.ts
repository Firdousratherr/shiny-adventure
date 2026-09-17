import { Prisma } from '@prisma/client';

export type Money = Prisma.Decimal | bigint | number | string;

export function decimal(value: Money) {
  return new Prisma.Decimal(value.toString());
}

export function deliveryCharge(subtotal: Money, freeThreshold: Money, flatCharge: Money) {
  return decimal(subtotal).gte(decimal(freeThreshold)) ? new Prisma.Decimal(0) : decimal(flatCharge);
}

export function total(subtotal: Money, delivery: Money) {
  return decimal(subtotal).plus(decimal(delivery));
}

export function grossProfit(sellingTotal: Money, sourceTotal: Money) {
  return decimal(sellingTotal).minus(decimal(sourceTotal));
}
