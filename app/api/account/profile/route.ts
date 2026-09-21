import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { db } from '../../../../lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (session?.user?.role !== 'customer' || !session.user.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await db.customerUser.findUnique({ where: { email: session.user.email }, select: { name: true, email: true } });
    if (!user) return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 });
    return NextResponse.json({ user });
  } catch (error) {
    console.error('profile load failed', error);
    return NextResponse.json({ error: 'Unable to load your profile right now.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (session?.user?.role !== 'customer' || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json();
    const name = String(body?.name || '').trim();
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: 'Name must be between 2 and 80 characters.' }, { status: 400 });
    }
    const customer = await db.customerUser.update({
      where: { email: session.user.email },
      data: { name },
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json({ ok: true, user: customer });
  } catch (error) {
    console.error('profile update failed', error);
    return NextResponse.json({ error: 'Unable to update your profile right now.' }, { status: 500 });
  }
}
