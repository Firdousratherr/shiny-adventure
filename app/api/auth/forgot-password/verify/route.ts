import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { db } from '../../../../../lib/db';
import { rateLimit } from '../../../../../lib/rate-limit';

const hashOtp = (otp: string) => createHash('sha256').update(otp).digest('hex');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || '').toLowerCase().trim();
    const otp = String(body?.otp || '').trim();
    const password = String(body?.password || '');

    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: 'Enter the 6-digit verification code.' }, { status: 400 });
    }
    if (password.length < 12) {
      return NextResponse.json({ error: 'New password must be at least 12 characters.' }, { status: 400 });
    }

    const limited = await rateLimit(`password-reset-verify:${email}`, 8, 600);
    if (process.env.NODE_ENV === 'production' && !limited.configured) {
      return NextResponse.json({ error: 'Password reset is temporarily unavailable.' }, { status: 503 });
    }
    if (limited.limited) return NextResponse.json({ error: 'Too many verification attempts. Please request a new code later.' }, { status: 429 });

    const pending = await db.passwordResetOtp.findUnique({ where: { email } });
    if (!pending || pending.expiresAt.getTime() < Date.now()) {
      if (pending) await db.passwordResetOtp.delete({ where: { email } }).catch(() => undefined);
      return NextResponse.json({ error: 'This code has expired. Please request a new one.' }, { status: 400 });
    }
    if (pending.attempts >= 8) return NextResponse.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 });

    if (hashOtp(otp) !== pending.otpHash) {
      await db.passwordResetOtp.update({ where: { email }, data: { attempts: { increment: 1 } } });
      return NextResponse.json({ error: 'Incorrect verification code.' }, { status: 400 });
    }

    const customer = await db.customerUser.findUnique({ where: { email } });
    if (!customer) {
      await db.passwordResetOtp.delete({ where: { email } });
      return NextResponse.json({ error: 'This reset request is no longer valid.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.$transaction([
      db.customerUser.update({ where: { email }, data: { passwordHash } }),
      db.passwordResetOtp.delete({ where: { email } }),
    ]);

    return NextResponse.json({ ok: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('password reset verification failed', error);
    return NextResponse.json({ error: 'Unable to reset your password right now.' }, { status: 500 });
  }
}
