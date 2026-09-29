import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';
import { securityRateLimit } from '../../../lib/rate-limit';
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const productId = typeof body.productId === 'string' ? body.productId : '';
  const inputEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const session = await auth();
  const email = session?.user?.role === 'customer' && session.user.email ? session.user.email.toLowerCase() : inputEmail;
  if (!productId || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  const limited = await securityRateLimit('stock-alert:' + email, 10, 600);
  if (limited.securityUnavailable) return NextResponse.json({ error: 'Stock alerts are temporarily unavailable. Please try again shortly.' }, { status: 503 });
  if (limited.limited) return NextResponse.json({ error: 'Too many stock alert requests. Please try again later.' }, { status: 429, headers: { 'Retry-After': '600' } });
  const product = await db.product.findFirst({ where: { id: productId, status: { in: ['ACTIVE','OUT_OF_STOCK'] } }, select: { id:true,stock:true } });
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  if (product.stock > 0) return NextResponse.json({ error: 'This product is already in stock.' }, { status: 409 });
  const customer = session?.user?.role === 'customer' && session.user.email ? await db.customerUser.findUnique({ where:{email:session.user.email}, select:{id:true} }) : null;
  await db.stockAlert.upsert({ where:{productId_email:{productId,email}}, create:{productId,email,customerId:customer?.id ?? null}, update:{customerId:customer?.id ?? null,notifiedAt:null} });
  return NextResponse.json({ ok:true });
}