import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { requireAdminPermission } from '../../../../../lib/admin-access';
import { recordAdminAudit } from '../../../../../lib/admin-audit';
export async function POST(request: Request) {
  if (!(await requireAdminPermission('orders'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.formData();
    const orderNumber = typeof body.get('orderNumber') === 'string' ? String(body.get('orderNumber')).trim().toUpperCase() : '';
    if (!/^ORD-\d{4}-\d{4,}$/.test(orderNumber)) return NextResponse.json({ error: 'Invalid order number.' }, { status: 400 });
    const order = await db.order.findUnique({ where: { orderNumber }, select: { id: true, deletedAt: true, status: true, totalAmount: true } });
    if (!order || order.deletedAt) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    await db.order.update({ where: { id: order.id }, data: { deletedAt: new Date() } });
    const admin = await requireAdminPermission('orders');
    if (admin) await recordAdminAudit({ adminId: admin.id, adminEmail: admin.email, action: 'ORDER_ARCHIVED', entityType: 'ORDER', entityId: order.id, details: { orderNumber, status: order.status, totalAmount: order.totalAmount.toString() } });
    return NextResponse.redirect(new URL('/admin/orders', request.url), 303);
  } catch (error) { console.error('admin order delete failed', error); return NextResponse.json({ error: 'Unable to delete order.' }, { status: 500 }); }
}