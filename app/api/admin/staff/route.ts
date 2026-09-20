import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { db } from '../../../../lib/db';
import { ADMIN_PERMISSIONS, requireSuperAdmin } from '../../../../lib/admin-access';

export async function GET() {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Super administrator access required.' }, { status: 403 });
  const staff = await db.adminUser.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, email: true, accessRole: true, permissions: true, isActive: true, createdAt: true } });
  return NextResponse.json({ staff, permissions: ADMIN_PERMISSIONS });
}

export async function POST(request: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Super administrator access required.' }, { status: 403 });
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const permissions = Array.isArray(body.permissions) ? body.permissions.filter((p: unknown): p is string => typeof p === 'string' && ADMIN_PERMISSIONS.some(x => x.key === p)) : [];
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    if (password.length < 12) return NextResponse.json({ error: 'Staff passwords must be at least 12 characters.' }, { status: 400 });
    if (!permissions.length) return NextResponse.json({ error: 'Select at least one permission.' }, { status: 400 });
    if (email === admin.email.toLowerCase()) return NextResponse.json({ error: 'Use your existing super-admin account.' }, { status: 400 });
    const passwordHash = await bcrypt.hash(password, 12);
    const staff = await db.adminUser.create({ data: { email, passwordHash, accessRole: 'STAFF', permissions, isActive: true }, select: { id: true, email: true, accessRole: true, permissions: true, isActive: true } });
    return NextResponse.json({ staff }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return NextResponse.json({ error: 'An admin account with this email already exists.' }, { status: 409 });
    console.error(e); return NextResponse.json({ error: 'Unable to create staff account.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: 'Super administrator access required.' }, { status: 403 });
  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'Staff ID is required.' }, { status: 400 });
    const permissions = Array.isArray(body.permissions) ? body.permissions.filter((p: unknown): p is string => typeof p === 'string' && ADMIN_PERMISSIONS.some(x => x.key === p)) : undefined;
    const data: Prisma.AdminUserUpdateInput = {};
    if (permissions) data.permissions = permissions;
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    if (typeof body.password === 'string' && body.password) {
      if (body.password.length < 12) return NextResponse.json({ error: 'Password must be at least 12 characters.' }, { status: 400 });
      data.passwordHash = await bcrypt.hash(body.password, 12);
    }
    const target = await db.adminUser.findUnique({ where: { id }, select: { id: true, accessRole: true } });
    if (!target || target.accessRole === 'SUPER_ADMIN') return NextResponse.json({ error: 'Only staff accounts can be managed here.' }, { status: 400 });
    const staff = await db.adminUser.update({ where: { id }, data, select: { id: true, email: true, accessRole: true, permissions: true, isActive: true } });
    return NextResponse.json({ staff });
  } catch (e) { console.error(e); return NextResponse.json({ error: 'Unable to update staff account.' }, { status: 500 }); }
}
