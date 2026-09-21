import { NextResponse } from 'next/server';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { db } from '../../../../lib/db';

type HealthStatus = 'healthy' | 'warning' | 'error';

function envStatus(keys: string[], required = false) {
  const configured = keys.every(key => Boolean(process.env[key]?.trim()));
  return {
    status: (configured ? 'healthy' : required ? 'error' : 'warning') as HealthStatus,
    configured,
  };
}

export async function GET() {
  const admin = await requireAdminPermission('settings');
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const checks: Record<string, { status: HealthStatus; configured?: boolean; detail?: string }> = {};

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy', detail: 'Database connection is working.' };
  } catch {
    checks.database = { status: 'error', detail: 'Database connection failed.' };
  }

  checks.blob = envStatus(['BLOB_READ_WRITE_TOKEN'], true);
  checks.razorpay = envStatus(['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'], true);
  checks.razorpayWebhook = envStatus(['RAZORPAY_WEBHOOK_SECRET'], false);
  checks.rateLimiting = envStatus(['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'], true);
  checks.email = envStatus(['BREVO_API_KEY'], false);
  checks.marketplaceScraping = envStatus(['SCRAPINGBEE_API_KEY'], false);
  checks.authSecret = envStatus(['AUTH_SECRET'], true);
  checks.siteUrl = envStatus(['NEXT_PUBLIC_SITE_URL'], true);

  const settings = await db.settings.findMany({
    where: { key: { in: ['freeShippingThreshold', 'flatDeliveryCharge'] } },
    select: { key: true, value: true },
  });
  checks.storeSettings = {
    status: settings.length === 2 ? 'healthy' : 'warning',
    detail: settings.length === 2 ? 'Core checkout settings are present.' : 'One or more core checkout settings are missing; defaults will be used.',
  };

  const statuses = Object.values(checks).map(check => check.status);
  const overall: HealthStatus = statuses.includes('error') ? 'error' : statuses.includes('warning') ? 'warning' : 'healthy';

  return NextResponse.json({
    overall,
    checkedAt: new Date().toISOString(),
    checks,
    notes: {
      email: 'Brevo API is recommended for Vercel; SMTP remains supported as a fallback.',
      blob: 'Private Blob storage requires BLOB_READ_WRITE_TOKEN or an equivalent Vercel OIDC setup.',
      razorpay: 'A configured key pair does not prove the credentials are valid; run a test-mode checkout to verify authentication.',
    },
  });
}
