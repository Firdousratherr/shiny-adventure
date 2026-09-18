import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { db } from '../../../../../lib/db';

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const enabled = body.enabled === true;
    const keyId = typeof body.keyId === 'string' ? body.keyId.trim().slice(0, 100) : '';
    await db.settings.upsert({ where: { key: 'razorpayEnabled' }, update: { value: enabled ? 'true' : 'false' }, create: { key: 'razorpayEnabled', value: enabled ? 'true' : 'false' } });
    if (keyId) await db.settings.upsert({ where: { key: 'razorpayKeyId' }, update: { value: keyId }, create: { key: 'razorpayKeyId', value: keyId } });
    return NextResponse.json({ enabled });
  } catch (error) { console.error('razorpay settings failed', error); return NextResponse.json({ error: 'Unable to update Razorpay settings.' }, { status: 500 }); }
}
