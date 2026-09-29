import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { assertSafeExternalHttpsUrl } from '../../../lib/safe-external-url';

const PRIVATE_BLOB_HOST = /(^|\.)private\.blob\.vercel-storage\.com$/i;
const REMOTE_IMAGE_HOST = /(^|\.)meesho\.com$/i;
const MAX_REMOTE_IMAGE_BYTES = 8 * 1024 * 1024;

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || '';
}

function isImageContentType(value: string) {
  return /^image\/(jpeg|png|webp|gif|avif|svg\+xml)$/i.test(value);
}

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

      const token = blobToken();
      if (!token) {
        console.error('Private Blob image requested but BLOB_READ_WRITE_TOKEN is unavailable at runtime.');
        return new NextResponse('Image storage is not configured.', { status: 503 });
      }

      const result = await get(pathname, { access: 'private', token });
      if (!result) return new NextResponse('Image not found.', { status: 404 });

      return new Response(result.stream, {
        headers: {
          'Content-Type': result.blob.contentType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
          'X-Zenvora-Image-Source': 'private-blob',
        },
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let response: Response | null = null;
    let target = await assertSafeExternalHttpsUrl(source.toString());
    try {
      for (let redirects = 0; redirects <= 3; redirects++) {
        response = await fetch(target.toString(), {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36',
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-IN,en;q=0.9',
            Referer: 'https://www.meesho.com/',
          },
          cache: 'no-store',
        });
        if (response.status < 300 || response.status >= 400) break;
        const location = response.headers.get('location');
        if (!location || redirects === 3) return new NextResponse('Remote image redirect is not allowed.', { status: 403 });
        target = await assertSafeExternalHttpsUrl(new URL(location, target).toString());
      }
    } finally {
      clearTimeout(timer);
    }

    if (!response || !response.ok || !response.body) {
      return new NextResponse('Remote image unavailable.', { status: 404 });
    }

    // Re-check the final URL after redirects to prevent the proxy from becoming
    // an unrestricted server-side fetcher.
    try {
      const finalUrl = new URL(response.url);
      if (!REMOTE_IMAGE_HOST.test(finalUrl.hostname)) {
        return new NextResponse('Remote image destination is not allowed.', { status: 403 });
      }
    } catch {
      return new NextResponse('Invalid remote image destination.', { status: 400 });
    }

    const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (contentType && !isImageContentType(contentType)) {
      return new NextResponse('Remote source did not return an image.', { status: 415 });
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_REMOTE_IMAGE_BYTES) {
      return new NextResponse('Remote image is too large.', { status: 413 });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
        'X-Zenvora-Image-Source': 'remote',
      },
    });
  } catch (error) {
    console.error('product image delivery failed', error);
    return new NextResponse('Unable to load image.', { status: 404 });
  }
}
