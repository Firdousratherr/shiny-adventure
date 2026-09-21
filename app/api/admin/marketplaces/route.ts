import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '../../../../lib/db';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { recordAdminAudit } from '../../../../lib/admin-audit';
import { credentialStatus, providerCapabilities, syncMarketplace } from '../../../../lib/marketplaces';
import { encryptionConfigured } from '../../../../lib/marketplace-crypto';

const PROVIDERS = [
  { key: 'AMAZON', name: 'Amazon', description: 'Amazon Selling Partner API', setup: 'SP-API developer + seller authorization' },
  { key: 'FLIPKART', name: 'Flipkart', description: 'Flipkart Marketplace Seller API v3', setup: 'Seller Developer Access' },
  { key: 'MEESHO', name: 'Meesho', description: 'Meesho seller/partner integration', setup: 'Official partner API access required' },
  { key: 'EBAY', name: 'eBay', description: 'eBay Browse API catalog import', setup: 'eBay Developer application' },
  { key: 'ETSY', name: 'Etsy', description: 'Etsy Open API v3', setup: 'Etsy app + OAuth seller authorization' },
  { key: 'SHOPIFY', name: 'Shopify', description: 'Shopify Admin GraphQL API', setup: 'Shopify custom/public app access token' },
] as const;

async function getIntegrations() {
  for (const p of PROVIDERS) {
    await db.marketplaceIntegration.upsert({ where: { provider: p.key }, update: {}, create: { provider: p.key } });
  }
  return db.marketplaceIntegration.findMany({ orderBy: { provider: 'asc' } });
}

export async function GET() {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });
  try {
    const integrations = await getIntegrations();
    const mapped = await Promise.all(integrations.map(async i => ({
      ...i,
      credentialsConfigured: await credentialStatus(i.provider),
      capabilities: providerCapabilities(i.provider),
    })));
    return NextResponse.json({ providers: PROVIDERS, integrations: mapped });
  } catch (error) {
    console.error('marketplace integrations load failed', error);
    return NextResponse.json({ error: 'Unable to load marketplace integrations.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });
  try {
    const body = await request.json();
    const provider = typeof body.provider === 'string' ? body.provider.toUpperCase() : '';
    if (!PROVIDERS.some(p => p.key === provider)) return NextResponse.json({ error: 'Unsupported marketplace.' }, { status: 400 });

    const current = await db.marketplaceIntegration.findUnique({ where: { provider } });
    const currentSettings = current?.settings && typeof current.settings === 'object' && !Array.isArray(current.settings)
      ? current.settings as Record<string, unknown>
      : {};
    const data: {
      enabled?: boolean;
      autoSync?: boolean;
      syncIntervalMinutes?: number;
      settings?: Prisma.InputJsonValue;
    } = {};

    if (typeof body.enabled === 'boolean') data.enabled = body.enabled;
    if (typeof body.autoSync === 'boolean') data.autoSync = body.autoSync;
    if (body.syncIntervalMinutes !== undefined) {
      const minutes = Number(body.syncIntervalMinutes);
      if (!Number.isInteger(minutes) || minutes < 15 || minutes > 1440) {
        return NextResponse.json({ error: 'Sync interval must be between 15 and 1440 minutes.' }, { status: 400 });
      }
      data.syncIntervalMinutes = minutes;
    }

    const allowedSettings = ['markupPercent', 'fixedAmount', 'maxItemsPerSync', 'syncProducts', 'syncOrders', 'syncInventory', 'query'];
    const settings = { ...currentSettings };
    for (const key of allowedSettings) {
      if (body.settings && Object.prototype.hasOwnProperty.call(body.settings, key)) settings[key] = body.settings[key];
    }
    if (body.settings) data.settings = settings as Prisma.InputJsonValue;

    const integration = await db.marketplaceIntegration.upsert({
      where: { provider },
      update: data,
      create: { provider, ...(data as any) },
    });

    const credentialsConfigured = await credentialStatus(provider);
    await recordAdminAudit({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'MARKETPLACE_SETTINGS_UPDATED',
      entityType: 'MARKETPLACE',
      entityId: integration.id,
      details: { provider, changes: data, credentialsConfigured },
    });

    return NextResponse.json({ integration, credentialsConfigured, capabilities: providerCapabilities(provider) });
  } catch (error) {
    console.error('marketplace integration update failed', error);
    return NextResponse.json({ error: 'Unable to update marketplace integration.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });
  try {
    const body = await request.json();
    const provider = typeof body.provider === 'string' ? body.provider.toUpperCase() : '';
    const integration = await db.marketplaceIntegration.findUnique({ where: { provider } });
    if (!integration) return NextResponse.json({ error: 'Marketplace integration not found.' }, { status: 404 });
    if (!integration.enabled) return NextResponse.json({ error: 'Turn this marketplace ON before syncing.' }, { status: 409 });

    const started = Date.now();
    const run = await db.marketplaceSyncRun.create({ data: { integrationId: integration.id, type: 'MANUAL', status: 'RUNNING' } });
    try {
      const result = await syncMarketplace(integration.id, provider, integration.settings);
      const duration = Date.now() - started;
      await db.marketplaceSyncRun.update({ where: { id: run.id }, data: { status: 'SUCCESS', productsFound: result.found, ordersFound: result.importedOrders, finishedAt: new Date() } });
      await db.marketplaceIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date(), lastSuccessAt: new Date(), lastError: null, importedProducts: { increment: result.importedProducts }, importedOrders: { increment: result.importedOrders }, healthStatus: 'HEALTHY', lastSyncDurationMs: duration },
      });
      await recordAdminAudit({ adminId: admin.id, adminEmail: admin.email, action: 'MARKETPLACE_SYNC_SUCCESS', entityType: 'MARKETPLACE', entityId: integration.id, details: { provider, runId: run.id, ...result, duration } });
      return NextResponse.json({ success: true, runId: run.id, ...result, duration });
    } catch (error) {
      const duration = Date.now() - started;
      const message = error instanceof Error ? error.message : 'Marketplace sync failed.';
      await db.marketplaceSyncRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: message, finishedAt: new Date() } });
      await db.marketplaceIntegration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date(), lastError: message, healthStatus: 'ERROR', lastSyncDurationMs: duration } });
      await recordAdminAudit({ adminId: admin.id, adminEmail: admin.email, action: 'MARKETPLACE_SYNC_FAILED', entityType: 'MARKETPLACE', entityId: integration.id, details: { provider, runId: run.id, error: message, duration } });
      return NextResponse.json({ error: message, runId: run.id }, { status: 502 });
    }
  } catch (error) {
    console.error('marketplace sync failed', error);
    return NextResponse.json({ error: 'Unable to start marketplace sync.' }, { status: 500 });
  }
}
