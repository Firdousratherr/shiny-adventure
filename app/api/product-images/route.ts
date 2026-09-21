import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';

const PRIVATE_BLOB_HOST = /(^|\.)private\.blob\.vercel-storage\.com$/;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('url');
  if (!raw) return NextResponse.json({ error: 'Image URL is required.' }, { status: 400 });

  let source: URL;
  try {
    source = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid image URL.' }, { status: 400 });
  }

  if (!PRIVATE_BLOB_HOST.test(source.hostname)) {
    return NextResponse.json({ error: 'Unsupported image host.' }, { status: 400 });
  }

  try {
    const pathname = decodeURIComponent(source.pathname.replace(/^\/+/, ''));
    if (!pathname) return NextResponse.json({ error: 'Image path is required.' }, { status: 400 });

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
