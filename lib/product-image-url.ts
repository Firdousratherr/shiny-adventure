export function productImageUrl(url: string | null | undefined) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('.private.blob.vercel-storage.com') || parsed.hostname === 'cdn.shopify.com' || parsed.hostname.endsWith('.cdn.shopify.com')) {
      return `/api/product-images?url=${encodeURIComponent(url)}`;
    }
    return url;
  } catch {
    return url;
  }
}
