import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { requireAdminPermission } from '../../../../../lib/admin-access';
import { recordAdminAudit } from '../../../../../lib/admin-audit';
import { encryptMarketplaceCredentials, encryptionConfigured } from '../../../../../lib/marketplace-crypto';
import { marketplaceCredentials, credentialStatus } from '../../../../../lib/marketplaces';
import { testShopifyConnection } from '../../../../../lib/shopify';

const PROVIDER = 'SHOPIFY' as const;
const FIELDS = ['storeDomain', 'clientId', 'clientSecret'] as const;

function cleanCredentials(value: unknown) {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const allowed = new Set(FIELDS);
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!allowed.has(key as (typeof FIELDS)[number]) || typeof raw !== 'string') continue;
    const v = raw.trim();
    if (v) out[key] = v;
  }
  return out;
}

function fieldStatus(credentials: Record<string, unknown>) {
  return FIELDS.reduce<Record<string, boolean>>((out, key) => {
    out[key] = Boolean(credentials[key]);
    return out;
  }, {});
}

export async function GET() {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });

  const stored = await marketplaceCredentials(PROVIDER);
  return NextResponse.json({
    configured: await credentialStatus(PROVIDER),
    fields: fieldStatus(stored),
  });
}

export async function PUT(request: Request) {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });
  if (!encryptionConfigured()) {
    return NextResponse.json({ error: 'Marketplace credential encryption is not configured on the server.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const patch = cleanCredentials(body.credentials);
    const existing = await marketplaceCredentials(PROVIDER);
    const merged = { ...existing, ...patch };

    if (!FIELDS.every(key => Boolean(merged[key]))) {
      return NextResponse.json({ error: 'Shopify Store Domain, Client ID and Client Secret are all required.' }, { status: 400 });
    }

    const connection = await testShopifyConnection(merged);
    const integration = await db.marketplaceIntegration.upsert({
      where: { provider: PROVIDER },
      update: {
        credentialsEncrypted: encryptMarketplaceCredentials(merged),
        enabled: true,
        healthStatus: 'HEALTHY',
        lastError: null,
      },
      create: {
        provider: PROVIDER,
        credentialsEncrypted: encryptMarketplaceCredentials(merged),
        enabled: true,
        healthStatus: 'HEALTHY',
      },
    });

    await recordAdminAudit({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SHOPIFY_CREDENTIALS_UPDATED',
      entityType: 'MARKETPLACE',
      entityId: integration.id,
      details: { provider: PROVIDER, fieldsUpdated: Object.keys(patch), shopName: connection.shopName },
    });

    return NextResponse.json({
      success: true,
      configured: true,
      connected: true,
      shopName: connection.shopName,
      detail: 'Connected to ' + connection.shopName + '. Shopify access tokens are renewed server-side when needed.',
      fields: fieldStatus(merged),
    });
  } catch (error) {
    console.error('shopify credentials save failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to connect Shopify.' }, { status: 502 });
  }
}

export async function DELETE() {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });

  const integration = await db.marketplaceIntegration.upsert({
    where: { provider: PROVIDER },
    update: {
      credentialsEncrypted: null,
      enabled: false,
      autoSync: false,
      healthStatus: 'UNKNOWN',
      lastError: null,
    },
    create: {
      provider: PROVIDER,
      enabled: false,
    },
  });

  await recordAdminAudit({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'SHOPIFY_CREDENTIALS_REMOVED',
    entityType: 'MARKETPLACE',
    entityId: integration.id,
    details: { provider: PROVIDER },
  });

  return NextResponse.json({ success: true, configured: false, fields: fieldStatus({}) });
}

export async function POST() {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });

  try {
    const credentials = await marketplaceCredentials(PROVIDER);
    if (!(await credentialStatus(PROVIDER))) {
      return NextResponse.json({ error: 'Connect Shopify from Marketplace Center before testing the connection.' }, { status: 409 });
    }

    const connection = await testShopifyConnection(credentials);
    await db.marketplaceIntegration.update({
      where: { provider: PROVIDER },
      data: { healthStatus: 'HEALTHY', lastError: null },
    });

    await recordAdminAudit({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SHOPIFY_CONNECTION_TESTED',
      entityType: 'MARKETPLACE',
      details: { provider: PROVIDER, success: true, shopName: connection.shopName },
    });

    return NextResponse.json({
      success: true,
      detail: 'Connected to ' + connection.shopName + '. Shopify access tokens are renewed server-side when needed.',
      shopName: connection.shopName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Shopify connection test failed.';
    await recordAdminAudit({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SHOPIFY_CONNECTION_TESTED',
      entityType: 'MARKETPLACE',
      details: { provider: PROVIDER, success: false },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
