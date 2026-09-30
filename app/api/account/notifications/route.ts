import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { db } from '../../../../lib/db';

async function customerId() {
  const session = await auth();
  if (session?.user?.role !== 'customer' || !session.user.email) return null;
  const user = await db.customerUser.findUnique({ where: { email: session.user.email }, select: { id: true } });
  return user?.id ?? null;
}

export async function GET() {
  const id = await customerId();
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const notifications = await db.customerNotification.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' }, take: 50 });
  const unread = await db.customerNotification.count({ where: { customerId: id, readAt: null } });
  return NextResponse.json({ notifications, unread });
}

export async function PATCH(request: Request) {
  const id = await customerId();
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const notificationId = typeof body.id === 'string' ? body.id : '';
  if (notificationId) {
    await db.customerNotification.updateMany({ where: { id: notificationId, customerId: id }, data: { readAt: new Date() } });
  } else {
    await db.customerNotification.updateMany({ where: { customerId: id, readAt: null }, data: { readAt: new Date() } });
  }
  return NextResponse.json({ ok: true });
}
