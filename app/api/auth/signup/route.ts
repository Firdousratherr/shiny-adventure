import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomInt, createHash } from 'node:crypto';
import { db } from '../../../../lib/db';
import { rateLimit } from '../../../../lib/rate-limit';
import { sendSignupOtp } from '../../../../lib/email';

const hashOtp = (otp: string) => createHash('sha256').update(otp).digest('hex');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').toLowerCase().trim();
    const password = String(body?.password || '');

    if (name.length < 2) return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    if (password.length < 12) return NextResponse.json({ error: 'Password must be at least 12 characters.' }, { status: 400 });

    const existing = await db.customerUser.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 });

    const limited = await rateLimit(`signup-otp:${email}`, 3, 600);
    if (process.env.NODE_ENV === 'production' && !limited.configured) return NextResponse.json({ error: 'Email verification is temporarily unavailable.' }, { status: 503 });
    if (limited.limited) return NextResponse.json({ error: 'Too many OTP requests. Please wait 10 minutes.' }, { status: 429 });

    const passwordHash = await bcrypt.hash(password, 12);
    const otp = String(randomInt(100000, 1000000));

    await db.signupOtp.upsert({
      where: { email },
      update: { name, passwordHash, otpHash: hashOtp(otp), expiresAt: new Date(Date.now() + 10 * 60 * 1000), attempts: 0 },
      create: { email, name, passwordHash, otpHash: hashOtp(otp), expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });

    const sent = await sendSignupOtp(email, otp);
    if (!sent) {
      await db.signupOtp.deleteMany({ where: { email } });
      return NextResponse.json({ error: 'We could not send the verification email. Please try again later.' }, { status: 503 });
    }

    return NextResponse.json({ ok: true, message: 'Verification code sent.' });
  } catch (error) {
    console.error('signup OTP request failed', error);
    return NextResponse.json({ error: 'Unable to start signup right now.' }, { status: 500 });
  }
}
