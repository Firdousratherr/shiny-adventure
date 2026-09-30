import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '../../../../auth';
import { db } from '../../../../lib/db';
import { securityRateLimit } from '../../../../lib/rate-limit';

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== 'customer' || !session.user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await securityRateLimit('account-delete:' + session.user.email, 2, 3600);
  if (limited.securityUnavailable) return NextResponse.json({ error: 'Security service is temporarily unavailable.' }, { status: 503 });
  if (limited.limited) return NextResponse.json({ error: 'Too many deletion attempts.' }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) return NextResponse.json({ error: 'Enter your current password to confirm deletion.' }, { status: 400 });
  const user = await db.customerUser.findUnique({ where: { email: session.user.email }, select: { id: true, email: true, passwordHash: true } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return NextResponse.json({ error: 'Password is incorrect.' }, { status: 400 });

  await db.$transaction(async tx => {
    await tx.order.updateMany({
      where: { email: user.email, deletedAt: null },
      data: { email: null, customerName: 'Deleted customer', phone: 'DELETED', addressLine1: 'Deleted customer', addressLine2: null, landmark: null, city: 'Deleted', district: 'Deleted', pinCode: '000000', state: 'Deleted' },
    });
    await tx.passwordResetOtp.deleteMany({ where: { email: user.email } });
    await tx.signupOtp.deleteMany({ where: { email: user.email } });
    await tx.customerUser.delete({ where: { id: user.id } });
  });
  return NextResponse.json({ ok: true });
}
