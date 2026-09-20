import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { put, del } from '@vercel/blob';
import { db } from '../../../../../lib/db';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === 'admin' ? session.user.email : null;
}
function safeExt(type: string) { if (type === 'image/jpeg') return 'jpg'; if (type === 'image/png') return 'png'; return 'webp'; }
function matchesMagicBytes(type: string, bytes: Uint8Array) {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.length >= 8 && bytes.slice(0, 8).every((b, i) => b === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][i]);
  if (type === 'image/webp') return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  return false;
}
export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const form = await request.formData(); const productId = String(form.get('productId') || ''); const file = form.get('file'); const altText = String(form.get('altText') || '').trim().slice(0, 160);
    if (!productId || !(file instanceof File)) return NextResponse.json({ error: 'Product and image are required.' }, { status: 400 });
    if (!ALLOWED.has(file.type) || file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: 'Only JPG, PNG or WebP images up to 5 MB are allowed.' }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer()); if (!matchesMagicBytes(file.type, bytes)) return NextResponse.json({ error: 'The uploaded file is not a valid image.' }, { status: 400 });
    const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } }); if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    const blob = await put(`products/${productId}/${crypto.randomUUID()}.${safeExt(file.type)}`, new Blob([bytes], { type: file.type }), { access: 'public', addRandomSuffix: false });
    try { const last = await db.productImage.aggregate({ where: { productId }, _max: { sortOrder: true } }); const sortOrder = (last._max.sortOrder ?? -1) + 1; const image = await db.productImage.create({ data: { productId, url: blob.url, altText: altText || null, sortOrder } }); return NextResponse.json({ image }, { status: 201 }); }
    catch (error) { try { await del(blob.url); } catch (cleanupError) { console.error('product image cleanup failed', cleanupError); } throw error; }
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Unable to upload image.' }, { status: 500 }); }
}
export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json(); const productId = typeof body.productId === 'string' ? body.productId : ''; const imageIds: string[] = Array.isArray(body.imageIds) ? body.imageIds.filter((x: unknown): x is string => typeof x === 'string') : [];
    if (!productId || !imageIds.length) return NextResponse.json({ error: 'Product and image order are required.' }, { status: 400 });
    const images = await db.productImage.findMany({ where: { productId }, select: { id: true } }); if (images.length !== imageIds.length || !images.every((i: { id: string }) => imageIds.includes(i.id))) return NextResponse.json({ error: 'Invalid image list.' }, { status: 400 });
    await db.$transaction(imageIds.map((id: string, index: number) => db.productImage.update({ where: { id }, data: { sortOrder: index } }))); return NextResponse.json({ ok: true });
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Unable to reorder images.' }, { status: 500 }); }
}
export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json(); const id = typeof body.id === 'string' ? body.id : ''; if (!id) return NextResponse.json({ error: 'Image ID is required.' }, { status: 400 });
    const image = await db.productImage.findUnique({ where: { id }, select: { id: true, url: true } }); if (!image) return NextResponse.json({ error: 'Image not found.' }, { status: 404 }); await db.productImage.delete({ where: { id } }); try { await del(image.url); } catch (error) { console.error('Blob deletion failed:', error); } return NextResponse.json({ ok: true });
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Unable to delete image.' }, { status: 500 }); }
}
