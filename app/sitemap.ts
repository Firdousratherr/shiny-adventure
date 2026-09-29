import type { MetadataRoute } from 'next';
import { db } from '../lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { status: 'ACTIVE' },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    }),
    db.category.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/track`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: 'monthly', priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: 'monthly', priority: 0.2 },
  ];

  return [
    ...staticRoutes,
    ...categories.map((category) => ({
      url: `${base}/products?category=${encodeURIComponent(category.slug)}`,
      lastModified: category.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: `${base}/product/${encodeURIComponent(product.slug)}`,
      lastModified: product.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
