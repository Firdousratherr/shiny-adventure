import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== 'customer' || !session.user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await db.customerUser.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await db.wishlist.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, include: { product: { include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } } } } });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== 'customer' || !session.user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await db.customerUser.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const productId = typeof body.productId === 'string' ? body.productId : '';
  if (!productId) return NextResponse.json({ error: 'Product ID is required.' }, { status: 400 });
  const product = await db.product.findFirst({ where: { id: productId, status: 'ACTIVE' }, select: { id: true } });
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  const item = await db.wishlist.upsert({ where: { userId_productId: { userId: user.id, productId } }, create: { userId: user.id, productId }, update: {} });
  return NextResponse.json(item);
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (session?.user?.role !== 'customer' || !session.user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await db.customerUser.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const productId = new URL(request.url).searchParams.get('productId') || '';
  if (!productId) return NextResponse.json({ error: 'Product ID is required.' }, { status: 400 });
  await db.wishlist.deleteMany({ where: { userId: user.id, productId } });
  return NextResponse.json({ ok: true });
}
