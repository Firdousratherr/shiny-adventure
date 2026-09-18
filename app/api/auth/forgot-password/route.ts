import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { db } from '../../../../lib/db';
import { rateLimit } from '../../../../lib/rate-limit';
import { sendPasswordResetOtp } from '../../../../lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || '').toLowerCase().trim();

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const limited = await rateLimit('password-reset:' + email, 5, 600);
    if (process.env.NODE_ENV === 'production' && !limited.configured) {
      return NextResponse.json({ error: 'Password reset is temporarily unavailable.' }, { status: 503 });
    }
    if (limited.limited) return NextResponse.json({ error: 'Too many reset attempts. Please wait 10 minutes.' }, { status: 429 });

    const customer = await db.customerUser.findUnique({ where: { email } });
    if (!customer) {
      return NextResponse.json({ ok: true, message: 'If an account exists for this email, a verification code has been sent.' });
    }

    const otp = String(randomInt(100000, 1000000));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.passwordResetOtp.upsert({
      where: { email },
      update: { otpHash, expiresAt, attempts: 0 },
      create: { email, otpHash, expiresAt },
    });

    const sent = await sendPasswordResetOtp(email, otp);
    if (!sent) {
      await db.passwordResetOtp.deleteMany({ where: { email } });
      return NextResponse.json({ error: 'We could not send the reset code. Please check the email service configuration and try again.' }, { status: 503 });
    }

    return NextResponse.json({ ok: true, message: 'If an account exists for this email, a verification code has been sent.' });
  } catch (error) {
    console.error('password reset request failed', error);
    return NextResponse.json({ error: 'Unable to start password reset right now.' }, { status: 500 });
  }
}
