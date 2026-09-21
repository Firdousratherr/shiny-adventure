import crypto from 'node:crypto';

export const PAYMENT_RESERVATION_MINUTES = 20;

export function createPaymentAccessToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashPaymentAccessToken(token: string) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function verifyPaymentAccessToken(token: string, expectedHash: string | null | undefined) {
  if (!/^[a-f0-9]{64}$/i.test(token) || !expectedHash) return false;
  const actual = Buffer.from(hashPaymentAccessToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
