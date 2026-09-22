import { NextResponse } from 'next/server';
import { requireAdminPermission } from '../../../../../lib/admin-access';
import { db } from '../../../../../lib/db';
import { recordAdminAudit } from '../../../../../lib/admin-audit';

export async function POST(request: Request) {
  const admin = await requireAdminPermission('settings');
  if (!admin) return NextResponse.json({ error: 'Settings permission required.' }, { status: 403 });

  try {
    const body = await request.json();
    const enabled = body.enabled === true;
    const keyId = typeof body.keyId === 'string' ? body.keyId.trim().slice(0, 100) : '';

    await db.settings.upsert({
      where: { key: 'razorpayEnabled' },
      update: { value: enabled ? 'true' : 'false' },
      create: { key: 'razorpayEnabled', value: enabled ? 'true' : 'false' },
    });

    if (keyId) {
      await db.settings.upsert({
        where: { key: 'razorpayKeyId' },
        update: { value: keyId },
        create: { key: 'razorpayKeyId', value: keyId },
      });
    }

    await recordAdminAudit({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'RAZORPAY_SETTINGS_UPDATED',
      entityType: 'SETTINGS',
      details: { enabled, keyIdChanged: Boolean(keyId) },
    });

    return NextResponse.json({ enabled });
  } catch (error) {
    console.error('razorpay settings failed', error);
    return NextResponse.json({ error: 'Unable to update Razorpay settings.' }, { status: 500 });
  }
}
