import { NextResponse } from 'next/server';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { db } from '../../../../lib/db';

export async function GET() {
  const admin = await requireAdminPermission('orders');
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [items, unread] = await Promise.all([
    db.adminNotification.findMany({ where: { dismissedAt: null }, orderBy: { createdAt: 'desc' }, take: 50 }),
    db.adminNotification.count({ where: { readAt: null, dismissedAt: null } }),
  ]);
  return NextResponse.json({ items, unread });
}

export async function POST(request: Request) {
  const admin = await requireAdminPermission('orders');
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  const action = body.action === 'dismiss' ? 'dismiss' : 'read';
  if (!id) return NextResponse.json({ error: 'Notification ID is required.' }, { status: 400 });
  const data = action === 'dismiss' ? { dismissedAt: new Date(), readAt: new Date() } : { readAt: new Date() };
  await db.adminNotification.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
