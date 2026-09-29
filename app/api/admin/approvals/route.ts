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

    const result = await db.$transaction(async tx => {
      const approval = await tx.adminApproval.findUnique({ where: { id } });
      if (!approval || approval.status !== 'PENDING') return null;

      if (decision === 'APPROVED' && approval.entityType === 'PRODUCT' && approval.action === 'PRICE_CHANGE' && approval.entityId) {
        const payload = approval.payload as { sellingPrice?: string; sourceCost?: string | null };
        const product = await tx.product.findUnique({
          where: { id: approval.entityId },
          select: { id: true, sellingPrice: true, sourceCost: true },
        });
        if (!product) throw new Error('PRODUCT_NO_LONGER_EXISTS');

        const updated = await tx.product.update({
          where: { id: approval.entityId },
          data: {
            ...(payload.sellingPrice !== undefined ? { sellingPrice: payload.sellingPrice } : {}),
            ...(payload.sourceCost !== undefined ? { sourceCost: payload.sourceCost } : {}),
          },
        });

        const claimed = await tx.adminApproval.updateMany({
          where: { id, status: 'PENDING' },
          data: { status: decision, reviewedBy: admin.email, reviewNote: note, reviewedAt: new Date() },
        });
        if (claimed.count !== 1) return null;

        return {
          approval,
          updatedApproval: { id, status: decision, reviewedBy: admin.email, reviewNote: note },
          product: {
            id: updated.id,
            beforeSellingPrice: product.sellingPrice.toString(),
            beforeSourceCost: product.sourceCost?.toString() ?? null,
            afterSellingPrice: updated.sellingPrice.toString(),
            afterSourceCost: updated.sourceCost?.toString() ?? null,
          },
        };
      }

      const claimed = await tx.adminApproval.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: decision, reviewedBy: admin.email, reviewNote: note, reviewedAt: new Date() },
      });
      if (claimed.count !== 1) return null;

      return {
        approval,
        updatedApproval: { id, status: decision, reviewedBy: admin.email, reviewNote: note },
        product: null,
      };
    });

    if (!result) return NextResponse.json({ error: 'Approval is no longer pending.' }, { status: 409 });

    if (result.product) {
      await recordAdminAudit({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'APPROVED_PRICE_CHANGE',
        entityType: 'PRODUCT',
        entityId: result.product.id,
        details: {
          approvalId: id,
          requestedBy: result.approval.requestedBy,
          before: { sellingPrice: result.product.beforeSellingPrice, sourceCost: result.product.beforeSourceCost },
          after: { sellingPrice: result.product.afterSellingPrice, sourceCost: result.product.afterSourceCost },
        },
      });
    }

    await recordAdminAudit({
      adminId: admin.id,
      adminEmail: admin.email,
      action: decision === 'APPROVED' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
      entityType: result.approval.entityType,
      entityId: result.approval.entityId,
      details: { approvalId: id, requestedBy: result.approval.requestedBy, note },
    });

    return NextResponse.json({
      approval: {
        id: result.updatedApproval.id,
        status: result.updatedApproval.status,
        reviewedBy: result.updatedApproval.reviewedBy,
        reviewNote: result.updatedApproval.reviewNote,
      },
    });
  } catch (error) {
    console.error('approval update failed', error);
    const message = error instanceof Error && error.message === 'PRODUCT_NO_LONGER_EXISTS'
      ? 'Product no longer exists.'
      : 'Unable to process approval.';
    return NextResponse.json({ error: message }, { status: message === 'Product no longer exists.' ? 404 : 500 });
  }
}
