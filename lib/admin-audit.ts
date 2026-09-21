import { db } from './db';

export async function recordAdminAudit(input: {
  adminId?: string | null;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: unknown;
}) {
  try {
    await db.adminAuditLog.create({
      data: {
        adminId: input.adminId || null,
        adminEmail: input.adminEmail,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        details: input.details as never,
      },
    });
  } catch (error) {
    console.error('admin audit log failed', error);
  }
}
