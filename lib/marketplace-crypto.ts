import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function keyFromEnv() {
  const raw = process.env.MARKETPLACE_ENCRYPTION_KEY;
  if (!raw) throw new Error('MARKETPLACE_ENCRYPTION_KEY is not configured.');
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('MARKETPLACE_ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64).');
  return key;
}

export function encryptMarketplaceCredentials(value: Record<string, unknown>) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, keyFromEnv(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptMarketplaceCredentials(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Invalid encrypted marketplace credentials.');
  const decipher = crypto.createDecipheriv(ALGORITHM, keyFromEnv(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64url')), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as Record<string, unknown>;
}

export function encryptionConfigured() {
  try { keyFromEnv(); return true; } catch { return false; }
}
