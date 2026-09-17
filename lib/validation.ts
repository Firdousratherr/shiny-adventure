import { z } from 'zod';

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  addressLine1: z.string().trim().min(5).max(200),
  addressLine2: z.string().trim().max(200).optional().or(z.literal('')),
  landmark: z.string().trim().max(120).optional().or(z.literal('')),
  city: z.string().trim().min(2).max(100),
  district: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pinCode: z.string().regex(/^\d{6}$/, 'PIN code must be exactly 6 digits'),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(99) })).min(1).max(50),
});

export const paymentSchema = z.object({
  orderNumber: z.string().regex(/^ORD-\d{4}-\d{4,}$/),
  upiTransactionId: z.string().trim().regex(/^\d{12}$/, 'UTR must be 12 digits'),
});

export const trackingSchema = z.object({
  orderNumber: z.string().regex(/^ORD-\d{4}-\d{4,}$/),
  phone: z.string().regex(/^[6-9]\d{9}$/),
});
