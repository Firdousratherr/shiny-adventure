import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '../../../../../lib/db';
import { rateLimit } from '../../../../../lib/rate-limit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || '').toLowerCase().trim();
    const otp = String(body?.otp || '').trim();

    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: 'Enter the 6-digit verification code.' }, { status: 400 });
    }

    const limited = await rateLimit('signup-verify:' + email, 10, 600);
    if (process.env.NODE_ENV === 'production' && !limited.configured) {
      return NextResponse.json({ error: 'Verification is temporarily unavailable.' }, { status: 503 });
    }
    if (limited.limited) return NextResponse.json({ error: 'Too many verification attempts. Please wait 10 minutes.' }, { status: 429 });

    const pending = await db.signupOtp.findUnique({ where: { email } });
    if (!pending || pending.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'This verification code has expired. Please request a new code.' }, { status: 400 });
    }
    if (pending.attempts >= 5) {
      return NextResponse.json({ error: 'Too many incorrect codes. Please request a new code.' }, { status: 429 });
    }

    const valid = await bcrypt.compare(otp, pending.otpHash);
    if (!valid) {
      await db.signupOtp.update({ where: { email }, data: { attempts: { increment: 1 } } });
      return NextResponse.json({ error: 'Incorrect verification code.' }, { status: 400 });
    }

    const existing = await db.customerUser.findUnique({ where: { email } });
    if (existing) {
      await db.signupOtp.delete({ where: { email } });
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 });
    }

    const customer = await db.customerUser.create({
      data: { name: pending.name, email: pending.email, passwordHash: pending.passwordHash },
    });
    await db.signupOtp.delete({ where: { email } });

    return NextResponse.json({ ok: true, customer: { id: customer.id, name: customer.name, email: customer.email } }, { status: 201 });
  } catch (error) {
    console.error('signup otp verification failed', error);
    return NextResponse.json({ error: 'Unable to verify your account right now.' }, { status: 500 });
  }
}
