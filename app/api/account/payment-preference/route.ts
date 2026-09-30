import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { db } from '../../../../lib/db';

const methods = new Set(['UPI_MANUAL', 'RAZORPAY']);

async function getCustomer() {
  const session = await auth();
  if (session?.user?.role !== 'customer' || !session.user.email) return null;
  return db.customerUser.findUnique({ where: { email: session.user.email }, select: { id: true } });
}

export async function GET() {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const preference = await db.customerPaymentPreference.findUnique({ where: { customerId: customer.id } });
  return NextResponse.json({ method: preference?.method ?? 'UPI_MANUAL' });
}

export async function PATCH(request: Request) {
  const customer = await getCustomer();
  if (!customer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const method = typeof body.method === 'string' ? body.method : '';
  if (!methods.has(method)) return NextResponse.json({ error: 'Unsupported payment method.' }, { status: 400 });
  const preference = await db.customerPaymentPreference.upsert({
    where: { customerId: customer.id },
    create: { customerId: customer.id, method },
    update: { method },
  });
  return NextResponse.json({ ok: true, method: preference.method });
}
