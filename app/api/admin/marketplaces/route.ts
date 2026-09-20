import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { recordAdminAudit } from '../../../../lib/admin-audit';

const PROVIDERS = [
  { key: 'AMAZON', name: 'Amazon', description: 'Amazon Seller / Selling Partner API' },
  { key: 'FLIPKART', name: 'Flipkart', description: 'Flipkart Seller API' },
  { key: 'MEESHO', name: 'Meesho', description: 'Meesho seller integration' },
] as const;

const defaults = () => PROVIDERS.map(p => ({
  provider: p.key,
  name: p.name,
  description: p.description,
}));

async function getIntegrations() {
  for (const p of PROVIDERS) {
    await db.marketplaceIntegration.upsert({
      where: { provider: p.key },
      update: {},
      create: { provider: p.key },
    });
  }
  return db.marketplaceIntegration.findMany({ orderBy: { provider: 'asc' } });
}

export async function GET() {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });
  try {
    const integrations = await getIntegrations();
    return NextResponse.json({
      providers: defaults(),
      integrations: integrations.map(i => ({
        ...i,
        credentialsConfigured: credentialStatus(i.provider),
      })),
    });
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

    const data: { enabled?: boolean; autoSync?: boolean; syncIntervalMinutes?: number } = {};
    if (typeof body.enabled === 'boolean') data.enabled = body.enabled;
    if (typeof body.autoSync === 'boolean') data.autoSync = body.autoSync;
    if (body.syncIntervalMinutes !== undefined) {
      const minutes = Number(body.syncIntervalMinutes);
      if (!Number.isInteger(minutes) || minutes < 15 || minutes > 1440) {
        return NextResponse.json({ error: 'Sync interval must be between 15 and 1440 minutes.' }, { status: 400 });
      }
      data.syncIntervalMinutes = minutes;
    }

    const integration = await db.marketplaceIntegration.upsert({
      where: { provider },
      update: data,
      create: { provider, ...data },
    });

    await recordAdminAudit({
      adminId: admin.id,
      adminEmail: admin.email,
      action: integration.enabled ? 'MARKETPLACE_ENABLED' : 'MARKETPLACE_DISABLED',
      entityType: 'MARKETPLACE',
      entityId: integration.id,
      details: { provider, changes: data, credentialsConfigured: credentialStatus(provider) },
    });

    if (data.autoSync === true && !credentialStatus(provider)) {
      return NextResponse.json({
        integration,
        warning: 'Auto-sync is saved, but this marketplace still needs its official API credentials before syncing can run.',
      });
    }

    return NextResponse.json({ integration });
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

    const run = await db.marketplaceSyncRun.create({ data: { integrationId: integration.id, type: 'MANUAL', status: 'FAILED', error: 'Official marketplace API adapter is not configured yet.' } });
    await db.marketplaceIntegration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date(), lastError: 'Official marketplace API adapter is not configured yet.' } });
    await recordAdminAudit({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'MARKETPLACE_SYNC_REQUESTED',
      entityType: 'MARKETPLACE',
      entityId: integration.id,
      details: { provider, runId: run.id, credentialsConfigured: credentialStatus(provider) },
    });

    return NextResponse.json({
      error: credentialStatus(provider)
        ? 'The marketplace is connected, but its provider-specific sync adapter still needs to be enabled in the deployment.'
        : 'Connect the official seller API credentials first. No scraping is used.',
      runId: run.id,
    }, { status: 501 });
  } catch (error) {
    console.error('marketplace sync failed', error);
    return NextResponse.json({ error: 'Unable to start marketplace sync.' }, { status: 500 });
  }
}

function credentialStatus(provider: string) {
  if (provider === 'AMAZON') {
    return Boolean(process.env.AMAZON_SP_API_REFRESH_TOKEN && process.env.AMAZON_SP_API_CLIENT_ID && process.env.AMAZON_SP_API_CLIENT_SECRET);
  }
  if (provider === 'FLIPKART') {
    return Boolean(process.env.FLIPKART_SELLER_API_KEY && process.env.FLIPKART_SELLER_API_SECRET);
  }
  if (provider === 'MEESHO') {
    return Boolean(process.env.MEESHO_SELLER_API_KEY && process.env.MEESHO_SELLER_API_SECRET);
  }
  return false;
}
