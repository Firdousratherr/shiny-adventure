import { describe, expect, it } from 'vitest';
import { assertSafeExternalHttpsUrl } from './safe-external-url';

describe('safe external URL validation', () => {
  it('rejects non-HTTPS URLs', async () => {
    await expect(assertSafeExternalHttpsUrl('http://example.com/image.jpg')).rejects.toThrow('EXTERNAL_URL_PROTOCOL_NOT_ALLOWED');
  });

  it('rejects localhost and private IPv4 hosts', async () => {
    await expect(assertSafeExternalHttpsUrl('https://localhost/image.jpg')).rejects.toThrow('EXTERNAL_URL_PRIVATE_HOST_NOT_ALLOWED');
    await expect(assertSafeExternalHttpsUrl('https://127.0.0.1/image.jpg')).rejects.toThrow('EXTERNAL_URL_PRIVATE_HOST_NOT_ALLOWED');
    await expect(assertSafeExternalHttpsUrl('https://192.168.1.10/image.jpg')).rejects.toThrow('EXTERNAL_URL_PRIVATE_HOST_NOT_ALLOWED');
  });

  it('rejects embedded URL credentials', async () => {
    await expect(assertSafeExternalHttpsUrl('https://user:pass@example.com/image.jpg')).rejects.toThrow('EXTERNAL_URL_CREDENTIALS_NOT_ALLOWED');
  });
});
