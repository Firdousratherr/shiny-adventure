import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '../../../lib/db';

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
    if (existing) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    const customer = await db.customerUser.create({ data: { name, email, passwordHash } });

    return NextResponse.json({ ok: true, user: { id: customer.id, name: customer.name, email: customer.email } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Unable to create your account right now.' }, { status: 500 });
  }
}
