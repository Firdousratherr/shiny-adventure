import { NextResponse } from 'next/server';
import { getAdminAccess } from '../../../../lib/admin-access';

export async function GET() {
  const admin = await getAdminAccess();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    isSuperAdmin: admin.isSuperAdmin,
    permissions: admin.permissions,
  });
}
