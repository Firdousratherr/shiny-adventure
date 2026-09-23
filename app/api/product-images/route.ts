import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';

const PRIVATE_BLOB_HOST = /(^|\\.)private\\.blob\\.vercel-storage\\.com$/;
const SHOPIFY_CDN_HOST = /(^|\\.)cdn\\.shopify\\.com$/;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('url');
  if (!raw) return NextResponse.json({ error: 'Image URL is required.' }, { status: 400 });

  let source: URL;
  try {
    source = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid image URL.' }, { status: 400 });
  }

  if (PRIVATE_BLOB_HOST.test(source.hostname)) {
    try {
      const pathname = decodeURIComponent(source.pathname.replace(/^\\/+/, ''));
      if (!pathname) return new NextResponse('Image path is required.', { status: 400 });
      const result = await get(pathname, { access: 'private' });
      if (!result) return new NextResponse('Image not found.', { status: 404 });
      return new Response(result.stream, {
        headers: {
          'Content-Type': result.blob.contentType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    } catch (error) {
      console.error('product image delivery failed', error);
      return new NextResponse('Unable to load image.', { status: 404 });
    }
  }

  if (SHOPIFY_CDN_HOST.test(source.hostname)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      let response: Response;
      try {
        response = await fetch(source.toString(), {
          signal: controller.signal,
          cache: 'no-store',
          headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
        });
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) return new NextResponse('Shopify image not found.', { status: response.status });
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      if (!contentType.startsWith('image/')) return new NextResponse('Shopify URL did not return an image.', { status: 415 });
      return new Response(response.body, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
        },
      });
    } catch (error) {
      console.error('Shopify product image delivery failed', error);
      return new NextResponse('Unable to load Shopify image.', { status: 502 });
    }
  }

  return NextResponse.json({ error: 'Unsupported image host.' }, { status: 400 });
}
