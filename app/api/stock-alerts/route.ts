import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const productId = typeof body.productId === 'string' ? body.productId : '';
  const inputEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const session = await auth();
  const email = session?.user?.role === 'customer' && session.user.email ? session.user.email.toLowerCase() : inputEmail;
  if (!productId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  const product = await db.product.findFirst({ where: { id: productId, status: { in: ['ACTIVE','OUT_OF_STOCK'] } }, select: { id:true,stock:true } });
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  if (product.stock > 0) return NextResponse.json({ error: 'This product is already in stock.' }, { status: 409 });
  const customer = session?.user?.role === 'customer' && session.user.email ? await db.customerUser.findUnique({ where:{email:session.user.email}, select:{id:true} }) : null;
  await db.stockAlert.upsert({ where:{productId_email:{productId,email}}, create:{productId,email,customerId:customer?.id ?? null}, update:{customerId:customer?.id ?? null,notifiedAt:null} });
  return NextResponse.json({ ok:true });
}