import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { Prisma } from '@prisma/client';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { db } from '../../../../lib/db';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const requireAdmin = async () => {
  const session = await auth();
  return session?.user?.role === 'admin' ? session.user.email || null : null;
};

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const b = await request.json();
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 100) : '';
    const slug = slugify(typeof b.slug === 'string' && b.slug.trim() ? b.slug : name);
    if (!name || !slug) return NextResponse.json({ error: 'Category name is required.' }, { status: 400 });
    const category = await db.category.create({ data: { name, slug } });
    return NextResponse.json({ category }, { status: 201 });
  } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return NextResponse.json({ error: 'Category slug already exists.' }, { status: 409 }); console.error(e); return NextResponse.json({ error: 'Unable to create category.' }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const b = await request.json();
    if (typeof b.id !== 'string' || !b.id) return NextResponse.json({ error: 'Category ID is required.' }, { status: 400 });
    const data: Prisma.CategoryUpdateInput = {};
    if (b.name !== undefined) { if (typeof b.name !== 'string' || !b.name.trim()) return NextResponse.json({ error: 'Category name is required.' }, { status: 400 }); data.name = b.name.trim().slice(0, 100); }
    if (b.slug !== undefined) { const slug = slugify(String(b.slug)); if (!slug) return NextResponse.json({ error: 'Invalid slug.' }, { status: 400 }); data.slug = slug; }
    const category = await db.category.update({ where: { id: b.id }, data });
    return NextResponse.json({ category });
  } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return NextResponse.json({ error: 'Category slug already exists.' }, { status: 409 }); if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return NextResponse.json({ error: 'Category not found.' }, { status: 404 }); console.error(e); return NextResponse.json({ error: 'Unable to update category.' }, { status: 500 }); }
}
