import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';

const PRIVATE_BLOB_HOST = /(^|\.)private\.blob\.vercel-storage\.com$/i;
const REMOTE_IMAGE_HOST = /(^|\.)meesho\.com$/i;
const MAX_REMOTE_IMAGE_BYTES = 8 * 1024 * 1024;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('url');
  if (!raw) return NextResponse.json({ error: 'Image URL is required.' }, { status: 400 });

  let source: URL;
  try {
    source = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid image URL.' }, { status: 400 });
  }

  const isPrivateBlob = PRIVATE_BLOB_HOST.test(source.hostname);
  const isAllowedRemote = REMOTE_IMAGE_HOST.test(source.hostname);
  if (!isPrivateBlob && !isAllowedRemote) {
    return NextResponse.json({ error: 'Unsupported image host.' }, { status: 400 });
  }

  try {
    if (isPrivateBlob) {
      const pathname = decodeURIComponent(source.pathname.replace(/^\/+/, ''));
      if (!pathname) return new NextResponse('Image path is required.', { status: 400 });

      const result = await get(pathname, { access: 'private' });
      if (!result) return new NextResponse('Image not found.', { status: 404 });

      return new Response(result.stream, {
        headers: {
          'Content-Type': result.blob.contentType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
        },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(source.toString(), {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          Referer: 'https://www.meesho.com/',
        },
        cache: 'no-store',
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok || !response.body) {
      return new NextResponse('Remote image unavailable.', { status: 404 });
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_REMOTE_IMAGE_BYTES) {
      return new NextResponse('Remote image is too large.', { status: 413 });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('product image delivery failed', error);
    return new NextResponse('Unable to load image.', { status: 404 });
  }
}
