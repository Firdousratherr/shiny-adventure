import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { put } from '@vercel/blob';
import { getAdminAccess } from '@/lib/admin-access';
import { db } from '@/lib/db';
import { parseMarketplaceSourceUrl, scrapeMarketplaceProduct } from '@/lib/marketplace-scraper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'imported-product';
}

function sellingPrice(cost: number, markup: number) {
  return Math.round(cost * (1 + markup / 100) * 100) / 100;
}

function normalizeCategory(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

async function importImage(productId: string, imageUrl: string, index: number, referer: string) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(imageUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36',
          Accept: 'image/avif,image/webp,image/jpeg,image/png,*/*',
          'Accept-Language': 'en-IN,en;q=0.9',
          Referer: referer || 'https://www.meesho.com/',
        },
        cache: 'no-store',
      });
      if (!response.ok || !response.body) return null;

      const type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      const extension = type === 'image/png'
        ? 'png'
        : type === 'image/webp'
          ? 'webp'
          : type === 'image/jpeg'
            ? 'jpg'
            : type === 'image/gif'
              ? 'gif'
              : type === 'image/avif'
                ? 'avif'
                : null;
      if (!extension) return null;

      const buffer = await response.arrayBuffer();
      if (!buffer.byteLength || buffer.byteLength > 5 * 1024 * 1024) return null;

      const bytes = new Uint8Array(buffer);
      const valid =
        (type === 'image/jpeg' && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
        (type === 'image/png' && bytes.length >= 8 && bytes.slice(0, 8).every((b, i) => b === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][i])) ||
        (type === 'image/webp' && bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') ||
        (type === 'image/gif' && bytes.length >= 6 && new TextDecoder().decode(bytes.slice(0, 6)) === 'GIF89a') ||
        (type === 'image/avif' && bytes.length >= 12);
      if (!valid) return null;

      const blob = await put(
        `products/${productId}/marketplace-${index}-${crypto.randomUUID()}.${extension}`,
        new Blob([buffer], { type }),
        { access: 'private', addRandomSuffix: false },
      );
      return blob.url;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}
