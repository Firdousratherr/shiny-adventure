import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { requireAdminPermission } from '../../../../../lib/admin-access';
import { recordAdminAudit } from '../../../../../lib/admin-audit';
import { encryptMarketplaceCredentials, encryptionConfigured } from '../../../../../lib/marketplace-crypto';
import { marketplaceCredentials, credentialStatus } from '../../../../../lib/marketplaces';

const PROVIDERS = ['AMAZON', 'FLIPKART', 'MEESHO', 'EBAY', 'ETSY', 'SHOPIFY'] as const;
type Provider = typeof PROVIDERS[number];
const fields: Record<Provider, string[]> = {
  AMAZON: ['clientId','clientSecret','refreshToken','region','marketplaceId'],
  FLIPKART: ['apiKey','apiSecret'],
  MEESHO: ['apiKey','apiSecret'],
  EBAY: ['clientId','clientSecret','environment','marketplaceId'],
  ETSY: ['apiKeyString','sharedSecret','accessToken','shopId'],
  SHOPIFY: ['storeDomain','accessToken'],
};

function providerOf(value: unknown): Provider | null {
  const p = typeof value === 'string' ? value.toUpperCase() : '';
  return (PROVIDERS as readonly string[]).includes(p) ? p as Provider : null;
}

function cleanCredentials(provider: Provider, value: unknown) {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const allowed = new Set(fields[provider]);
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!allowed.has(key) || typeof raw !== 'string') continue;
    const v = raw.trim();
    if (v) out[key] = v;
  }
  return out;
}

export async function GET(request: Request) {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });
  const provider = providerOf(new URL(request.url).searchParams.get('provider'));
  if (!provider) return NextResponse.json({ error: 'Unsupported marketplace.' }, { status: 400 });
  const integration = await db.marketplaceIntegration.findUnique({ where: { provider }, select: { credentialsEncrypted: true } });
  const stored = integration?.credentialsEncrypted ? await marketplaceCredentials(provider) : {};
  return NextResponse.json({
    configured: await credentialStatus(provider),
    fields: fields[provider].reduce<Record<string, boolean>>((out, key) => { out[key] = Boolean(stored[key]); return out; }, {}),
  });
}

export async function PUT(request: Request) {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });
  if (!encryptionConfigured()) return NextResponse.json({ error: 'Marketplace encryption is not configured. Add MARKETPLACE_ENCRYPTION_KEY to the server environment first.' }, { status: 503 });
  try {
    const body = await request.json();
    const provider = providerOf(body.provider);
    if (!provider) return NextResponse.json({ error: 'Unsupported marketplace.' }, { status: 400 });
    const patch = cleanCredentials(provider, body.credentials);
    const existing = await marketplaceCredentials(provider);
    const merged = { ...existing, ...patch };
    if (!Object.keys(merged).length) return NextResponse.json({ error: 'Enter at least one credential.' }, { status: 400 });
    const integration = await db.marketplaceIntegration.upsert({
      where: { provider },
      update: { credentialsEncrypted: encryptMarketplaceCredentials(merged), healthStatus: 'UNKNOWN', lastError: null },
      create: { provider, credentialsEncrypted: encryptMarketplaceCredentials(merged) },
    });
    await recordAdminAudit({ adminId: admin.id, adminEmail: admin.email, action: 'MARKETPLACE_CREDENTIALS_UPDATED', entityType: 'MARKETPLACE', entityId: integration.id, details: { provider, fieldsUpdated: Object.keys(patch) } });
    return NextResponse.json({ success: true, configured: await credentialStatus(provider), fields: fields[provider].reduce<Record<string, boolean>>((out, key) => { out[key] = Boolean(merged[key]); return out; }, {}) });
  } catch (error) {
    console.error('marketplace credentials save failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save marketplace credentials.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });
  const provider = providerOf(new URL(request.url).searchParams.get('provider'));
  if (!provider) return NextResponse.json({ error: 'Unsupported marketplace.' }, { status: 400 });
  const integration = await db.marketplaceIntegration.update({ where: { provider }, data: { credentialsEncrypted: null, enabled: false, autoSync: false, healthStatus: 'UNKNOWN' } });
  await recordAdminAudit({ adminId: admin.id, adminEmail: admin.email, action: 'MARKETPLACE_CREDENTIALS_REMOVED', entityType: 'MARKETPLACE', entityId: integration.id, details: { provider } });
  return NextResponse.json({ success: true, configured: false });
}

export async function POST(request: Request) {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });
  try {
    const body = await request.json();
    const provider = providerOf(body.provider);
    if (!provider) return NextResponse.json({ error: 'Unsupported marketplace.' }, { status: 400 });
    const credentials = await marketplaceCredentials(provider);
    if (!(await credentialStatus(provider))) return NextResponse.json({ error: 'Required credentials are not configured.' }, { status: 400 });
    let detail = 'Connection successful.';
    if (provider === 'MEESHO') throw new Error('Meesho requires official partner API access; connection testing is unavailable until that access is provided.');
    if (provider === 'SHOPIFY') {
      const domain = String(credentials.storeDomain ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      const response = await fetch(`https://${domain}/admin/api/2026-07/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': String(credentials.accessToken ?? '') }, body: JSON.stringify({ query: '{ shop { name } }' }), cache: 'no-store' });
      const data: any = await response.json(); if (!response.ok || data.errors?.length) throw new Error(data.errors?.[0]?.message || `Shopify returned ${response.status}`); detail = `Connected to ${data.data?.shop?.name || domain}.`;
    } else if (provider === 'EBAY') {
      const base = String(credentials.environment ?? 'production') === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
      const response = await fetch(`${base}/identity/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope', cache: 'no-store' });
      if (!response.ok) throw new Error(`eBay authentication failed (${response.status}).`); detail = 'eBay OAuth authentication successful.';
    } else if (provider === 'FLIPKART') {
      const response = await fetch('https://api.flipkart.net/oauth-service/oauth/token?grant_type=client_credentials&scope=Seller_Api,Default', { headers: { Authorization: `Basic ${Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString('base64')}` }, cache: 'no-store' });
      if (!response.ok) throw new Error(`Flipkart authentication failed (${response.status}).`); detail = 'Flipkart authentication successful.';
    } else if (provider === 'ETSY') {
      const response = await fetch(`https://api.etsy.com/v3/application/shops/${credentials.shopId}`, { headers: { 'x-api-key': `${credentials.apiKeyString}:${credentials.sharedSecret}`, Authorization: `Bearer ${credentials.accessToken}` }, cache: 'no-store' });
      if (!response.ok) throw new Error(`Etsy authentication failed (${response.status}).`); detail = 'Etsy authentication successful.';
    } else if (provider === 'AMAZON') {
      const mod: any = await import('amazon-sp-api'); const SellingPartner = mod.SellingPartner ?? mod.default;
      const client = new SellingPartner({ region: String(credentials.region ?? 'eu'), refresh_token: String(credentials.refreshToken), credentials: { SELLING_PARTNER_APP_CLIENT_ID: String(credentials.clientId), SELLING_PARTNER_APP_CLIENT_SECRET: String(credentials.clientSecret) } });
      await client.callAPI({ operation: 'getMarketplaceParticipations', endpoint: 'sellers' }); detail = 'Amazon SP-API authentication successful.';
    }
    await db.marketplaceIntegration.update({ where: { provider }, data: { healthStatus: 'HEALTHY', lastError: null } });
    await recordAdminAudit({ adminId: admin.id, adminEmail: admin.email, action: 'MARKETPLACE_CONNECTION_TESTED', entityType: 'MARKETPLACE', details: { provider, success: true } });
    return NextResponse.json({ success: true, detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection test failed.';
    await recordAdminAudit({ adminId: admin.id, adminEmail: admin.email, action: 'MARKETPLACE_CONNECTION_TESTED', entityType: 'MARKETPLACE', details: { provider: 'unknown', success: false } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
