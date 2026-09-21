import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim().toUpperCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '').slice(-10) : '';
  if (!/^ORD-\d{4}-\d{4,}$/.test(orderNumber) || phone.length !== 10) return NextResponse.json({ error: 'Enter a valid order number and 10-digit phone number.' }, { status: 400 });
  const order = await db.order.findFirst({ where: { orderNumber, phone: { contains: phone } }, select: { orderNumber:true,status:true,createdAt:true,courierName:true,trackingNumber:true,trackingUrl:true,history:{orderBy:{createdAt:'asc'},select:{oldStatus:true,newStatus:true,changedBy:true,note:true,createdAt:true}} } });
  if (!order) return NextResponse.json({ error: 'Order not found. Check your order number and phone number.' }, { status: 404 });
  return NextResponse.json({ order });
}