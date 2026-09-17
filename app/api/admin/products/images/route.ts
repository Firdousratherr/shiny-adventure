import { NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { auth } from '../../../../../auth';
import { db } from '../../../../../lib/db';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function requireAdmin() {
  const session = await auth();
  return session?.user?.email ? session.user.email : null;
}

function safeExt(type: string) {
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/png') return 'png';
  return 'webp';
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const form = await request.formData();
    const productId = String(form.get('productId') || '');
    const file = form.get('file');
    const altText = String(form.get('altText') || '').trim().slice(0, 160);
    if (!productId || !(file instanceof File)) return NextResponse.json({ error: 'Product and image are required.' }, { status: 400 });
    if (!ALLOWED.has(file.type) || file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: 'Only JPG, PNG or WebP images up to 5 MB are allowed.' }, { status: 400 });
    const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

    const ext = safeExt(file.type);
    const key = `products/${productId}/${crypto.randomUUID()}.${ext}`;
    const blob = await put(key, file, { access: 'public', addRandomSuffix: false });
    const last = await db.productImage.aggregate({ where: { productId }, _max: { sortOrder: true } });
    const sortOrder = (last._max.sortOrder ?? -1) + 1;
    const image = await db.productImage.create({ data: { productId, url: blob.url, altText: altText || null, sortOrder } });
    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to upload image.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const productId = typeof body.productId === 'string' ? body.productId : '';
    const imageIds = Array.isArray(body.imageIds) ? body.imageIds.filter((x: unknown): x is string => typeof x === 'string') : [];
    if (!productId || !imageIds.length) return NextResponse.json({ error: 'Product and image order are required.' }, { status: 400 });
    const images = await db.productImage.findMany({ where: { productId }, select: { id: true } });
    if (images.length !== imageIds.length || !images.every(i => imageIds.includes(i.id))) return NextResponse.json({ error: 'Invalid image list.' }, { status: 400 });
    await db.$transaction(imageIds.map((id, index) => db.productImage.update({ where: { id }, data: { sortOrder: index } })));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to reorder images.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Image ID is required.' }, { status: 400 });
    const image = await db.productImage.findUnique({ where: { id }, select: { id: true, url: true } });
    if (!image) return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
    await db.productImage.delete({ where: { id } });
    try { await del(image.url); } catch (error) { console.error('Blob deletion failed:', error); }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to delete image.' }, { status: 500 });
  }
}
