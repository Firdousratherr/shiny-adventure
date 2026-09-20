import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '../../../../lib/admin-access';
import { db } from '../../../../lib/db';

export async function GET(request: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Super administrator access required.' }, { status: 403 });
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 200);
  const logs = await db.adminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  return NextResponse.json({ logs });
}
