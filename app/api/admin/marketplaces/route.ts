import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '../../../../lib/db';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { recordAdminAudit } from '../../../../lib/admin-audit';
import { credentialStatus, providerCapabilities, syncMarketplace } from '../../../../lib/marketplaces';
import { getScrapingBeeApiKey, hasScrapingBeeApiKey } from '../../../../lib/scrapingbee';

const PROVIDERS = [
  { key: 'SHOPIFY', name: 'Shopify', description: 'Shopify Admin GraphQL API', setup: 'Shopify app + client credentials' },
  { key: 'MEESHO', name: 'Meesho', description: 'Automatic public catalogue discovery via ScrapingBee', setup: 'ScrapingBee API key' },
] as const;

async function getIntegration(provider: 'SHOPIFY' | 'MEESHO') {
  return db.marketplaceIntegration.upsert({
    where: { provider },
    update: {},
    create: { provider },
  });
}

export async function GET() {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });
  try {
    const shopify = await getIntegration('SHOPIFY');
    const meesho = await getIntegration('MEESHO');
    console.info('marketplace runtime config', {
      vercelEnv: process.env.VERCEL_ENV ?? 'unknown',
      scrapingBeeConfigured: hasScrapingBeeApiKey(),
      scrapingBeeKeyLength: getScrapingBeeApiKey().length,
      shopifyEnvConfigured: await credentialStatus('SHOPIFY'),
    });
    return NextResponse.json({
      providers: PROVIDERS,
      integrations: [
        { ...shopify, credentialsConfigured: await credentialStatus('SHOPIFY'), capabilities: providerCapabilities('SHOPIFY') },
        { ...meesho, credentialsConfigured: hasScrapingBeeApiKey(), capabilities: providerCapabilities('MEESHO') },
      ],
    });
  } catch (error) {
    console.error('marketplace integration load failed', error);
    return NextResponse.json({ error: 'Unable to load Shopify integration.' }, { status: 500 });
  }
}

function isProvider(provider: unknown): provider is 'SHOPIFY' | 'MEESHO' {
  return provider === 'SHOPIFY' || provider === 'MEESHO';
}

export async function PATCH(request: Request) {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });
  try {
    const body = await request.json();
    if (!isProvider(body.provider)) return NextResponse.json({ error: 'Unsupported marketplace provider.' }, { status: 400 });

    const current = await getIntegration(body.provider);
    const currentSettings = current.settings && typeof current.settings === 'object' && !Array.isArray(current.settings)
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

    const allowedSettings = [
      'markupPercent', 'fixedAmount', 'maxItemsPerSync', 'syncProducts', 'syncOrders', 'syncInventory',
      'mode', 'skipExisting', 'skipOutOfStock', 'skipWithoutImages', 'skipWithoutPrice',
      'minSourcePrice', 'maxSourcePrice', 'minInventory', 'roundingMode', 'roundingValue',
      'minSellingPrice', 'maxSellingPrice', 'protectLockedPrice', 'updatePrice',
      'importImages', 'importDescriptions', 'importInventory', 'keywords', 'categories', 'shardCountPerRun', 'shardCursor', 'sitemapShards', 'sitemapFetchedAt', 'importStatus',
    ];
    const settings = { ...currentSettings };
    for (const key of allowedSettings) {
      if (body.settings && Object.prototype.hasOwnProperty.call(body.settings, key)) settings[key] = body.settings[key];
    }
    if (body.settings) data.settings = settings as Prisma.InputJsonValue;

    const integration = await db.marketplaceIntegration.update({
      where: { id: current.id },
      data,
    });

    const credentialsConfigured = body.provider === 'MEESHO' ? hasScrapingBeeApiKey() : await credentialStatus('SHOPIFY');
    await recordAdminAudit({
      adminId: admin.id,
      adminEmail: admin.email,
      action: body.provider + '_MARKETPLACE_SETTINGS_UPDATED',
      entityType: 'MARKETPLACE',
      entityId: integration.id,
      details: { provider: body.provider, changes: data, credentialsConfigured },
    });

    return NextResponse.json({ integration, credentialsConfigured, capabilities: providerCapabilities(body.provider) });
  } catch (error) {
    console.error('shopify marketplace update failed', error);
    return NextResponse.json({ error: 'Unable to update Shopify marketplace settings.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });
  try {
    const body = await request.json();
    if (!isProvider(body.provider)) return NextResponse.json({ error: 'Unsupported marketplace provider.' }, { status: 400 });

    const integration = await getIntegration(body.provider);
    if (!integration.enabled) return NextResponse.json({ error: 'Turn this marketplace ON before syncing.' }, { status: 409 });
    if (body.provider === 'SHOPIFY' && !(await credentialStatus('SHOPIFY'))) return NextResponse.json({ error: 'Connect Shopify from Marketplace Center before syncing.' }, { status: 409 });
    if (body.provider === 'MEESHO' && !hasScrapingBeeApiKey()) return NextResponse.json({ error: 'Add SCRAPINGBEE_API_KEY to the Vercel Production environment and redeploy before enabling Meesho Auto Import.' }, { status: 409 });

    const started = Date.now();
    const run = await db.marketplaceSyncRun.create({ data: { integrationId: integration.id, type: 'MANUAL', status: 'RUNNING' } });

    try {
      const result = await syncMarketplace(integration.id, body.provider, integration.settings);
      const duration = Date.now() - started;
      await db.marketplaceSyncRun.update({
        where: { id: run.id },
        data: { status: 'SUCCESS', productsFound: result.found, ordersFound: result.importedOrders, finishedAt: new Date() },
      });
      await db.marketplaceIntegration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: new Date(),
          lastSuccessAt: new Date(),
          lastError: null,
          importedProducts: result.importedProducts,
          importedOrders: result.importedOrders,
          healthStatus: 'HEALTHY',
          lastSyncDurationMs: duration,
        },
      });
      await recordAdminAudit({
        adminId: admin.id,
        adminEmail: admin.email,
        action: body.provider + '_MARKETPLACE_SYNC_SUCCESS',
        entityType: 'MARKETPLACE',
        entityId: integration.id,
        details: { provider: body.provider, runId: run.id, ...result, duration },
      });
      return NextResponse.json({ success: true, runId: run.id, ...result, duration });
    } catch (error) {
      const duration = Date.now() - started;
      const message = error instanceof Error ? error.message : 'Shopify sync failed.';
      await db.marketplaceSyncRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', error: message, finishedAt: new Date() },
      });
      await db.marketplaceIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date(), lastError: message, healthStatus: 'ERROR', lastSyncDurationMs: duration },
      });
      await recordAdminAudit({
        adminId: admin.id,
        adminEmail: admin.email,
        action: body.provider + '_MARKETPLACE_SYNC_FAILED',
        entityType: 'MARKETPLACE',
        entityId: integration.id,
        details: { provider: body.provider, runId: run.id, error: message, duration },
      });
      return NextResponse.json({ error: message, runId: run.id }, { status: 502 });
    }
  } catch (error) {
    console.error('shopify marketplace sync failed', error);
    return NextResponse.json({ error: 'Unable to start Shopify sync.' }, { status: 500 });
  }
}
