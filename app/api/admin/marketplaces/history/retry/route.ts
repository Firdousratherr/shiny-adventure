import { NextResponse } from 'next/server';
import { db } from '../../../../../../lib/db';
import { requireAdminPermission } from '../../../../../../lib/admin-access';
import { credentialStatus, marketplaceCredentials, importItems, type SyncItem } from '../../../../../../lib/marketplaces';
import { getShopifyAccessToken } from '../../../../../../lib/shopify';

const QUERY = 'query ProductById($ids:[ID!]!) { nodes(ids:$ids) { ... on Product { id title descriptionHtml vendor productType onlineStoreUrl totalInventory images(first:20){nodes{url}} variants(first:100){nodes{id title sku barcode price compareAtPrice inventoryQuantity}} collections(first:10){nodes{id title handle}} } } }';

export async function POST(request: Request) {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });

  try {
    const body = await request.json();
    const logId = typeof body.logId === 'string' ? body.logId.trim() : '';
    if (!logId) return NextResponse.json({ error: 'Import log ID is required.' }, { status: 400 });

    const log = await db.marketplaceImportLog.findUnique({
      where: { id: logId },
      include: { integration: true },
    });
    if (!log) return NextResponse.json({ error: 'Import log not found.' }, { status: 404 });
    if (log.integration.provider !== 'SHOPIFY') return NextResponse.json({ error: 'Retry is currently available for Shopify imports only.' }, { status: 409 });
    if (log.status !== 'FAILED') return NextResponse.json({ error: 'Only failed imports can be retried.' }, { status: 409 });
    if (!(await credentialStatus('SHOPIFY'))) return NextResponse.json({ error: 'Shopify is not configured.' }, { status: 409 });

    const { domain, accessToken } = await getShopifyAccessToken(await marketplaceCredentials('SHOPIFY'));
    const response = await fetch('https://' + domain + '/admin/api/2026-07/graphql.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
      body: JSON.stringify({ query: QUERY, variables: { ids: [log.externalId] } }),
      cache: 'no-store',
    });
    const json: any = await response.json();
    if (!response.ok || json.errors?.length) {
      throw new Error(json.errors?.map((error: any) => error.message).join('; ') || 'Shopify request failed.');
    }

    const product = json.data?.nodes?.find(Boolean);
    if (!product) return NextResponse.json({ error: 'The Shopify product no longer exists or is not accessible.' }, { status: 404 });

    const item: SyncItem = {
      externalId: product.id,
      title: product.title,
      sourceUrl: product.onlineStoreUrl || null,
      sourceCost: Number(product.variants?.nodes?.[0]?.price || 0) || null,
      imageUrl: product.images?.nodes?.[0]?.url || null,
      rawData: product,
    };

    const settings = log.integration.settings && typeof log.integration.settings === 'object'
      ? log.integration.settings as Record<string, unknown>
      : {};

    const result = await importItems(log.integration.id, 'SHOPIFY', [item], {
      ...settings,
      maxItemsPerSync: 1,
      automatic: false,
      changedBy: admin.email || 'ADMIN',
    });

    const linked = await db.marketplaceProduct.count({
      where: { integrationId: log.integration.id, productId: { not: null } },
    });
    await db.marketplaceIntegration.update({
      where: { id: log.integration.id },
      data: { importedProducts: linked, lastSuccessAt: new Date(), lastError: null, healthStatus: 'HEALTHY' },
    });

    return NextResponse.json({
      success: true,
      created: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Retry failed.' }, { status: 502 });
  }
}
