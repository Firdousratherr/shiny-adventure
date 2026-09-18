import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '../../../../../lib/db';
import { rateLimit } from '../../../../../lib/rate-limit';

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
      return NextResponse.json({ error: 'Password must be at least 12 characters.' }, { status: 400 });
    }

    const limited = await rateLimit('password-reset-verify:' + email, 10, 600);
    if (process.env.NODE_ENV === 'production' && !limited.configured) {
      return NextResponse.json({ error: 'Password reset is temporarily unavailable.' }, { status: 503 });
    }
    if (limited.limited) return NextResponse.json({ error: 'Too many verification attempts. Please wait 10 minutes.' }, { status: 429 });

    const pending = await db.passwordResetOtp.findUnique({ where: { email } });
    if (!pending || pending.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'This reset code has expired. Please request a new code.' }, { status: 400 });
    }
    if (pending.attempts >= 5) {
      return NextResponse.json({ error: 'Too many incorrect codes. Please request a new code.' }, { status: 429 });
    }

    const valid = await bcrypt.compare(otp, pending.otpHash);
    if (!valid) {
      await db.passwordResetOtp.update({ where: { email }, data: { attempts: { increment: 1 } } });
      return NextResponse.json({ error: 'Incorrect reset code.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const customer = await db.customerUser.findUnique({ where: { email } });
    if (!customer) {
      await db.passwordResetOtp.delete({ where: { email } });
      return NextResponse.json({ error: 'Unable to reset this account.' }, { status: 400 });
    }

    await db.customerUser.update({ where: { email }, data: { passwordHash } });
    await db.passwordResetOtp.delete({ where: { email } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('password reset verification failed', error);
    return NextResponse.json({ error: 'Unable to reset your password right now.' }, { status: 500 });
  }
}
