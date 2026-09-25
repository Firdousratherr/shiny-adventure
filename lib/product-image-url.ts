const PROXIED_IMAGE_HOSTS = /(^|\\.)(meesho\\.com|cdn\\.shopify\\.com|myshopify\\.com)$/i;

export function productImageUrl(url: string | null | undefined) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.endsWith('.private.blob.vercel-storage.com') ||
      PROXIED_IMAGE_HOSTS.test(parsed.hostname)
    ) {
      return `/api/product-images?url=${encodeURIComponent(url)}`;
    }
    return url;
  } catch {
    return url;
  }
}
