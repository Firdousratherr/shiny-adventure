import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '../../../../lib/admin-access';
import { db } from '../../../../lib/db';
import { recordAdminAudit } from '../../../../lib/admin-audit';

export async function GET() {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Super administrator access required.' }, { status: 403 });
  const approvals = await db.adminApproval.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 100 });
  return NextResponse.json({ approvals });
}

export async function PATCH(request: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Super administrator access required.' }, { status: 403 });
  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const decision = body.decision === 'APPROVE' ? 'APPROVED' : body.decision === 'REJECT' ? 'REJECTED' : '';
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null;
    if (!id || !decision) return NextResponse.json({ error: 'Approval ID and decision are required.' }, { status: 400 });

    const approval = await db.adminApproval.findUnique({ where: { id } });
    if (!approval || approval.status !== 'PENDING') return NextResponse.json({ error: 'Approval is no longer pending.' }, { status: 409 });

    if (decision === 'APPROVED' && approval.entityType === 'PRODUCT' && approval.action === 'PRICE_CHANGE' && approval.entityId) {
      const payload = approval.payload as { sellingPrice?: string; sourceCost?: string | null };
      const product = await db.product.findUnique({ where: { id: approval.entityId }, select: { id: true, sellingPrice: true, sourceCost: true } });
      if (!product) return NextResponse.json({ error: 'Product no longer exists.' }, { status: 404 });
      const updated = await db.product.update({
        where: { id: approval.entityId },
        data: {
          ...(payload.sellingPrice !== undefined ? { sellingPrice: payload.sellingPrice } : {}),
          ...(payload.sourceCost !== undefined ? { sourceCost: payload.sourceCost } : {}),
        },
      });
      await recordAdminAudit({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'APPROVED_PRICE_CHANGE',
        entityType: 'PRODUCT',
        entityId: updated.id,
        details: { approvalId: id, requestedBy: approval.requestedBy, before: { sellingPrice: product.sellingPrice.toString(), sourceCost: product.sourceCost?.toString() ?? null }, after: { sellingPrice: updated.sellingPrice.toString(), sourceCost: updated.sourceCost?.toString() ?? null } },
      });
    }

    const updatedApproval = await db.adminApproval.update({
      where: { id },
      data: { status: decision, reviewedBy: admin.email, reviewNote: note, reviewedAt: new Date() },
    });
    await recordAdminAudit({ adminId: admin.id, adminEmail: admin.email, action: decision === 'APPROVED' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED', entityType: approval.entityType, entityId: approval.entityId, details: { approvalId: id, requestedBy: approval.requestedBy, note } });
    return NextResponse.json({ approval: updatedApproval });
  } catch (error) {
    console.error('approval update failed', error);
    return NextResponse.json({ error: 'Unable to process approval.' }, { status: 500 });
  }
}
