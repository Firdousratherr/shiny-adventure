import type { MetadataRoute } from 'next';
import { db } from '../lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zenvora-online.vercel.app').replace(/\/$/, '');
  const [products, categories] = await Promise.all([
    db.product.findMany({ where: { status: 'ACTIVE' }, select: { slug: true, updatedAt: true } }),
    db.category.findMany({ select: { slug: true, updatedAt: true } }),
  ]);
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: base + '/products', lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    ...categories.map(c => ({ url: base + '/products?category=' + encodeURIComponent(c.slug), lastModified: c.updatedAt, changeFrequency: 'daily' as const, priority: 0.7 })),
    ...products.map(p => ({ url: base + '/product/' + encodeURIComponent(p.slug), lastModified: p.updatedAt, changeFrequency: 'daily' as const, priority: 0.8 })),
  ];
}
