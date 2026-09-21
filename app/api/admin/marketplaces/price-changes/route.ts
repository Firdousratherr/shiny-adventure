import { NextResponse } from 'next/server';
import { getAdminAccess } from '../../../../../lib/admin-access';
import { db } from '../../../../../lib/db';

export async function POST(request: Request) {
  const admin = await getAdminAccess();
  if (!admin || (!admin.isSuperAdmin && !admin.permissions.includes('marketplaces'))) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'Price change ID is required.' }, { status: 400 });
  const updated = await db.marketplacePriceChange.update({ where: { id }, data: { acknowledged: true }, select: { id: true, acknowledged: true } });
  return NextResponse.json(updated);
}
