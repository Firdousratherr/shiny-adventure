import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '../../../../auth';
import { db } from '../../../../lib/db';
import { securityRateLimit } from '../../../../lib/rate-limit';

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== 'customer' || !session.user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await securityRateLimit('account-password:' + session.user.email, 5, 600);
  if (limited.securityUnavailable) return NextResponse.json({ error: 'Security service is temporarily unavailable.' }, { status: 503 });
  if (limited.limited) return NextResponse.json({ error: 'Too many attempts. Please wait and try again.' }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (newPassword.length < 12) return NextResponse.json({ error: 'New password must be at least 12 characters.' }, { status: 400 });
  if (newPassword === currentPassword) return NextResponse.json({ error: 'New password must be different.' }, { status: 400 });
  const user = await db.customerUser.findUnique({ where: { email: session.user.email }, select: { id: true, passwordHash: true } });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
  await db.customerUser.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
  return NextResponse.json({ ok: true });
}
