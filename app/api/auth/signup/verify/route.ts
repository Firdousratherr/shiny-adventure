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

    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: 'Enter the 6-digit verification code.' }, { status: 400 });
    }

    const limited = await rateLimit(`signup-verify:${email}`, 8, 600);
    if (process.env.NODE_ENV === 'production' && !limited.configured) return NextResponse.json({ error: 'Email verification is temporarily unavailable.' }, { status: 503 });
    if (limited.limited) return NextResponse.json({ error: 'Too many verification attempts. Please request a new code later.' }, { status: 429 });

    const pending = await db.signupOtp.findUnique({ where: { email } });
    if (!pending || pending.expiresAt.getTime() < Date.now()) {
      if (pending) await db.signupOtp.delete({ where: { email } }).catch(() => undefined);
      return NextResponse.json({ error: 'This code has expired. Please request a new one.' }, { status: 400 });
    }

    if (pending.attempts >= 8) {
      return NextResponse.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 });
    }

    if (hashOtp(otp) !== pending.otpHash) {
      await db.signupOtp.update({ where: { email }, data: { attempts: { increment: 1 } } });
      return NextResponse.json({ error: 'Incorrect verification code.' }, { status: 400 });
    }

    const existing = await db.customerUser.findUnique({ where: { email } });
    if (existing) {
      await db.signupOtp.delete({ where: { email } });
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 });
    }

    const customer = await db.customerUser.create({
      data: { name: pending.name, email, passwordHash: pending.passwordHash },
      select: { id: true, name: true, email: true },
    });
    await db.signupOtp.delete({ where: { email } });

    return NextResponse.json({ ok: true, user: customer });
  } catch (error) {
    console.error('signup OTP verification failed', error);
    return NextResponse.json({ error: 'Unable to verify your email right now.' }, { status: 500 });
  }
}
