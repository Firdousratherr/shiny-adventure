import { NextResponse } from 'next/server';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { db } from '../../../../lib/db';

export async function GET() {
  const a = await requireAdminPermission('products');
  if (!a) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const reviews = await db.productReview.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { product: { select: { name: true } } },
  });
  return NextResponse.json({ reviews });
}

export async function PATCH(req: Request) {
  const a = await requireAdminPermission('products');
  if (!a) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await req.json();
  if (!b.id || !['APPROVED', 'REJECTED', 'PENDING'].includes(b.status)) return NextResponse.json({ error: 'Invalid review update.' }, { status: 400 });
  const review = await db.productReview.update({
    where: { id: b.id },
    data: { status: b.status, verified: Boolean(b.verified) },
  });
  return NextResponse.json({ review });
}
