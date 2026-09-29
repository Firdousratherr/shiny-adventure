const PROXIED_IMAGE_HOSTS = /(^|\.)meesho\.com$/i;
const PRIVATE_BLOB_HOST = /(^|\.)private\.blob\.vercel-storage\.com$/i;

export function productImageUrl(url: string | null | undefined) {
  if (!url) return undefined;
  if (url.startsWith('/api/product-images?') || url.startsWith('/_next/')) return url;

  try {
    const parsed = new URL(url);
    if (
      PRIVATE_BLOB_HOST.test(parsed.hostname) ||
      PROXIED_IMAGE_HOSTS.test(parsed.hostname)
    ) {
      return `/api/product-images?url=${encodeURIComponent(url)}`;
    }
    return url;
  } catch {
    return url;
  }
}
