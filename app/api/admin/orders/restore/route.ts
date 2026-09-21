import { NextResponse } from 'next/server';
import { requireAdminPermission } from '../../../../../lib/admin-access';
import { db } from '../../../../../lib/db';
export async function POST(request: Request) {
  const admin = await requireAdminPermission('orders');
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const contentType = request.headers.get('content-type') || '';
    const orderNumber = contentType.includes('application/json') ? String((await request.json()).orderNumber || '') : String((await request.formData()).get('orderNumber') || '');
    if (!orderNumber) return NextResponse.json({ error: 'Order number is required.' }, { status: 400 });
    const order = await db.order.update({ where: { orderNumber: orderNumber.trim().toUpperCase() }, data: { deletedAt: null }, select: { orderNumber: true } });
    return NextResponse.json({ ok: true, orderNumber: order.orderNumber });
  } catch { return NextResponse.json({ error: 'Archived order not found.' }, { status: 404 }); }
}