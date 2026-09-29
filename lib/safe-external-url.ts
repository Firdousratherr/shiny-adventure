import 'server-only';

import dns from 'node:dns/promises';
import net from 'node:net';

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a,b,c] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127);
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    return normalized === '::1' || normalized === '::' ||
      normalized.startsWith('fc') || normalized.startsWith('fd') ||
      normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
      normalized.startsWith('fea') || normalized.startsWith('feb');
  }
  return true;
}

export async function assertSafeExternalHttpsUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('EXTERNAL_URL_PROTOCOL_NOT_ALLOWED');
  if (url.username || url.password) throw new Error('EXTERNAL_URL_CREDENTIALS_NOT_ALLOWED');

  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || net.isIP(host) && isPrivateIp(host)) {
    throw new Error('EXTERNAL_URL_PRIVATE_HOST_NOT_ALLOWED');
  }

  const addresses = await dns.lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(address => isPrivateIp(address.address))) {
    throw new Error('EXTERNAL_URL_PRIVATE_HOST_NOT_ALLOWED');
  }
  return url;
}
