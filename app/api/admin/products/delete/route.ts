import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { requireAdminPermission } from '../../../../../lib/admin-access';
import { recordAdminAudit } from '../../../../../lib/admin-audit';

export async function POST(request: Request) {
  const admin = await requireAdminPermission('products');
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const action = body.action === 'DELETE' ? 'DELETE' : 'HIDE';
    if (!id) return NextResponse.json({ error: 'Product ID is required.' }, { status: 400 });

    const product = await db.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        orderItems: { select: { id: true }, take: 1 },
        inventoryMovements: { select: { id: true }, take: 1 },
      },
    });
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

    if (action === 'HIDE') {
      await db.product.update({ where: { id }, data: { status: 'HIDDEN' } });
      await recordAdminAudit({ adminId: admin.id, adminEmail: admin.email, action: 'PRODUCT_HIDDEN', entityType: 'PRODUCT', entityId: id, details: { name: product.name } });
      return NextResponse.json({ ok: true, id, action: 'HIDDEN' });
    }

    if (product.orderItems.length || product.inventoryMovements.length) {
      return NextResponse.json(
        { error: 'This product has order or inventory history and cannot be permanently deleted. Hide it instead to preserve transaction records.' },
        { status: 409 },
      );
    }

    await db.$transaction(async tx => {
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });

    await recordAdminAudit({ adminId: admin.id, adminEmail: admin.email, action: 'PRODUCT_DELETED', entityType: 'PRODUCT', entityId: id, details: { name: product.name } });
    return NextResponse.json({ ok: true, id, action: 'DELETED' });
  } catch (e) {
    console.error('admin product delete failed', e);
    return NextResponse.json({ error: 'Unable to delete product.' }, { status: 500 });
  }
}
