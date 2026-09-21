import { describe, expect, it } from 'vitest';
import { canTransition } from './status';

describe('order status transitions', () => {
  it('allows payment confirmation only through the payment flow', () => {
    expect(canTransition('PAYMENT_PENDING', 'CONFIRMED')).toBe(true);
  });

  it('allows normal fulfillment progression', () => {
    expect(canTransition('CONFIRMED', 'ORDERED_FROM_SOURCE')).toBe(true);
    expect(canTransition('ORDERED_FROM_SOURCE', 'SHIPPED')).toBe(true);
    expect(canTransition('SHIPPED', 'DELIVERED')).toBe(true);
  });

  it('allows RTO from shipped and refund after RTO', () => {
    expect(canTransition('SHIPPED', 'RTO')).toBe(true);
    expect(canTransition('RTO', 'REFUNDED')).toBe(true);
  });

  it('rejects terminal-state changes', () => {
    expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false);
    expect(canTransition('REFUNDED', 'DELIVERED')).toBe(false);
  });

  it('rejects skipping backward into payment pending', () => {
    expect(canTransition('CONFIRMED', 'PAYMENT_PENDING')).toBe(false);
    expect(canTransition('SHIPPED', 'PAYMENT_PENDING')).toBe(false);
  });
});
