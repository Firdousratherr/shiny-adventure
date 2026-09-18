import type { OrderStatus } from '@prisma/client';

export const orderStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
  PAYMENT_PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['ORDERED_FROM_SOURCE', 'SHIPPED', 'CANCELLED'],
  ORDERED_FROM_SOURCE: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RTO', 'RETURN_REQUESTED'],
  DELIVERED: ['RETURN_REQUESTED'],
  CANCELLED: [],
  RTO: ['REFUNDED'],
  RETURN_REQUESTED: ['REFUNDED', 'DELIVERED'],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return orderStatusTransitions[from]?.includes(to) ?? false;
}
