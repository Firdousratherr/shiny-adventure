import { db } from './db';
import { decryptMarketplaceCredentials } from './marketplace-crypto';
import { getShopifyAccessToken } from './shopify';

export type SyncItem = {
  externalId: string;
  title: string;
  sourceUrl?: string | null;
  sourceCost?: number | null;
  imageUrl?: string | null;
  rawData?: unknown;
};

type Settings = {
  markupPercent?: number;
  fixedAmount?: number;
  maxItemsPerSync?: number;
  syncProducts?: boolean;
  syncOrders?: boolean;
  syncInventory?: boolean;
  query?: string;
  automatic?: boolean;
  skipExisting?: boolean;
  skipOutOfStock?: boolean;
  skipWithoutImages?: boolean;
  skipWithoutPrice?: boolean;
  changedBy?: string;
};

const REQUIRED_FIELDS: Record<string, string[]> = {
  AMAZON: ['clientId', 'clientSecret', 'refreshToken'],
  FLIPKART: ['apiKey', 'apiSecret'],
  MEESHO: ['apiKey', 'apiSecret'],
  EBAY: ['clientId', 'clientSecret'],
  ETSY: ['apiKeyString', 'sharedSecret', 'accessToken', 'shopId'],
  SHOPIFY: ['storeDomain', 'clientId', 'clientSecret'],
};

const FIELD_ENV: Record<string, Record<string, string>> = {
  AMAZON: { clientId: 'AMAZON_SP_API_CLIENT_ID', clientSecret: 'AMAZON_SP_API_CLIENT_SECRET', refreshToken: 'AMAZON_SP_API_REFRESH_TOKEN' },
  FLIPKART: { apiKey: 'FLIPKART_SELLER_API_KEY', apiSecret: 'FLIPKART_SELLER_API_SECRET' },
  MEESHO: { apiKey: 'MEESHO_SELLER_API_KEY', apiSecret: 'MEESHO_SELLER_API_SECRET' },
  EBAY: { clientId: 'EBAY_CLIENT_ID', clientSecret: 'EBAY_CLIENT_SECRET' },
  ETSY: { apiKeyString: 'ETSY_API_KEYSTRING', sharedSecret: 'ETSY_API_SHARED_SECRET', accessToken: 'ETSY_ACCESS_TOKEN', shopId: 'ETSY_SHOP_ID' },
  SHOPIFY: { storeDomain: 'SHOPIFY_STORE_DOMAIN', clientId: 'SHOPIFY_CLIENT_ID', clientSecret: 'SHOPIFY_CLIENT_SECRET' },
};

export async function marketplaceCredentials(provider: string) {
  // Shopify is intentionally server-configured only. Never read or decrypt
  // Shopify credentials from the database; they live in Vercel environment variables.
  if (provider === 'SHOPIFY') {
    return {
      storeDomain: process.env.SHOPIFY_STORE_DOMAIN ?? '',
      clientId: process.env.SHOPIFY_CLIENT_ID ?? '',
      clientSecret: process.env.SHOPIFY_CLIENT_SECRET ?? '',
    };
  }

  const integration = await db.marketplaceIntegration.findUnique({ where: { provider }, select: { credentialsEncrypted: true } });
  let stored: Record<string, unknown> = {};
  if (integration?.credentialsEncrypted) stored = decryptMarketplaceCredentials(integration.credentialsEncrypted);
  return { ...stored };
}

export async function credentialStatus(provider: string) {
  const required = REQUIRED_FIELDS[provider] ?? [];
  const envMap = FIELD_ENV[provider] ?? {};
  const stored: Record<string, unknown> = await marketplaceCredentials(provider);
  return required.length > 0 && required.every(field => Boolean(stored[field] || process.env[envMap[field]]));
}

export function providerCapabilities(provider: string) {
  return {
    AMAZON: { products: true, orders: true, inventory: true, note: 'Amazon SP-API' },
    FLIPKART: { products: true, orders: true, inventory: true, note: 'Flipkart Seller API v3' },
    MEESHO: { products: false, orders: false, inventory: false, note: 'Official partner access required; no public seller API configured' },
    EBAY: { products: true, orders: false, inventory: false, note: 'eBay Browse API catalog import' },
    ETSY: { products: true, orders: true, inventory: true, note: 'Etsy Open API v3' },
    SHOPIFY: { products: true, orders: true, inventory: true, note: 'Shopify Admin GraphQL API' },
  }[provider] ?? { products: false, orders: false, inventory: false, note: 'Unsupported provider' };
}

function settingsOf(value: unknown): Settings {
  if (!value || typeof value !== 'object') return {};
  return value as Settings;
}

function priceWithMarkup(cost: number | null | undefined, settings: Settings) {
  if (!cost || cost <= 0) return 0;
  const markup = Number(settings.markupPercent ?? 0);
  const fixed = Number(settings.fixedAmount ?? 0);
  return Math.round((cost * (1 + markup / 100) + fixed) * 100) / 100;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70) || 'product';
}

export async function importItems(integrationId: string, provider: string, items: SyncItem[], settings: Settings) {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const limit = Math.max(1, Math.min(500, Number(settings.maxItemsPerSync ?? items.length)));

  for (const item of items.slice(0, limit)) {
    const raw = item.rawData && typeof item.rawData === 'object' ? item.rawData as any : {};
    const cost = item.sourceCost && item.sourceCost > 0 ? item.sourceCost : null;
    const sellingPrice = priceWithMarkup(cost, settings);
    const imageUrls = provider === 'SHOPIFY' && Array.isArray(raw.images?.nodes)
      ? raw.images.nodes.map((x: any) => String(x?.url || '')).filter(Boolean).slice(0, 20)
      : item.imageUrl ? [item.imageUrl] : [];

    const existing = await db.marketplaceProduct.findUnique({
      where: { integrationId_externalId: { integrationId, externalId: item.externalId } },
      include: { product: { select: { id: true, sellingPrice: true } } },
    });

    if (settings.skipExisting && existing?.productId) {
      skipped++;
      await db.marketplaceImportLog.create({
        data: {
          integrationId, productId: existing.productId, externalId: item.externalId,
          sourceUrl: item.sourceUrl ?? null, title: item.title, status: 'SKIPPED',
          automatic: Boolean(settings.automatic), sourceCost: cost, sellingPrice: sellingPrice || null,
          importedImages: 0, error: null,
        },
      });
      continue;
    }
    if (settings.skipOutOfStock && provider === 'SHOPIFY' && Number(raw.totalInventory ?? 0) <= 0) {
      skipped++;
      await db.marketplaceImportLog.create({ data: {
        integrationId, productId: existing?.productId ?? null, externalId: item.externalId,
        sourceUrl: item.sourceUrl ?? null, title: item.title, status: 'SKIPPED',
        automatic: Boolean(settings.automatic), sourceCost: cost, sellingPrice: sellingPrice || null,
        importedImages: 0, error: 'Out of stock',
      }});
      continue;
    }
    if (settings.skipWithoutImages && imageUrls.length === 0) {
      skipped++;
      await db.marketplaceImportLog.create({ data: {
        integrationId, productId: existing?.productId ?? null, externalId: item.externalId,
        sourceUrl: item.sourceUrl ?? null, title: item.title, status: 'SKIPPED',
        automatic: Boolean(settings.automatic), sourceCost: cost, sellingPrice: sellingPrice || null,
        importedImages: 0, error: 'No images',
      }});
      continue;
    }
    if (settings.skipWithoutPrice && !cost) {
      skipped++;
      await db.marketplaceImportLog.create({ data: {
        integrationId, productId: existing?.productId ?? null, externalId: item.externalId,
        sourceUrl: item.sourceUrl ?? null, title: item.title, status: 'SKIPPED',
        automatic: Boolean(settings.automatic), sourceCost: null, sellingPrice: null,
        importedImages: 0, error: 'No source price',
      }});
      continue;
    }

    let productId = existing?.productId ?? null;
    const collections = Array.isArray(raw.collections?.nodes) ? raw.collections.nodes : [];
    const categoryName = provider === 'SHOPIFY'
      ? String(collections[0]?.title || raw.productType || '').trim()
      : '';
    let categoryId: string | null = null;
    if (categoryName) {
      const slug = slugify(categoryName);
      const category = await db.category.upsert({
        where: { slug },
        update: { name: categoryName },
        create: { name: categoryName, slug },
      });
      categoryId = category.id;
    }

    let action: 'CREATED' | 'UPDATED' = 'CREATED';
    if (!productId) {
      const baseSlug = slugify(item.title);
      let slug = baseSlug;
      for (let n = 2; ; n++) {
        const clash = await db.product.findUnique({ where: { slug } });
        if (!clash) break;
        slug = `${baseSlug}-${provider.toLowerCase()}-${n}`;
      }
      const product = await db.product.create({
        data: {
          name: item.title,
          slug,
          description: provider === 'SHOPIFY' ? String(raw.descriptionHtml || '') || null : null,
          sourceUrl: item.sourceUrl ?? null,
          sourceCost: cost,
          sellingPrice: sellingPrice || 0,
          stock: provider === 'SHOPIFY' ? Number(raw.totalInventory ?? 0) || 0 : 0,
          categoryId,
          status: 'DRAFT',
        },
      });
      productId = product.id;
      imported++;
    } else {
      action = 'UPDATED';
      const oldSellingPrice = Number(existing?.product?.sellingPrice ?? 0);
      await db.product.update({
        where: { id: productId },
        data: {
          name: item.title,
          description: provider === 'SHOPIFY' ? String(raw.descriptionHtml || '') || null : undefined,
          sourceUrl: item.sourceUrl ?? undefined,
          sourceCost: cost ?? undefined,
          ...(sellingPrice > 0 ? { sellingPrice } : {}),
          ...(provider === 'SHOPIFY' ? { stock: Number(raw.totalInventory ?? 0) || 0, categoryId } : {}),
        },
      });
      updated++;
      if (sellingPrice > 0 && oldSellingPrice !== sellingPrice) {
        await db.productPriceHistory.create({
          data: {
            productId,
            sourceCost: cost,
            oldSellingPrice,
            newSellingPrice: sellingPrice,
            markupPercent: Number(settings.markupPercent ?? 0),
            reason: 'MARKETPLACE_IMPORT',
            changedBy: settings.changedBy ?? 'MARKETPLACE_IMPORT',
          },
        });
      }
    }

    let importedImages = 0;
    if (productId) {
      for (const url of imageUrls) {
        const exists = await db.productImage.findFirst({ where: { productId, url } });
        if (!exists) {
          await db.productImage.create({ data: { productId, url, altText: item.title, sortOrder: importedImages } });
          importedImages++;
        }
      }
    }

    await db.marketplaceProduct.upsert({
      where: { integrationId_externalId: { integrationId, externalId: item.externalId } },
      update: {
        productId, title: item.title, sourceUrl: item.sourceUrl ?? null,
        rawData: item.rawData as any, lastSourceCost: cost,
        sourceAvailability: provider === 'SHOPIFY' ? (Number(raw.totalInventory ?? 0) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK') : 'UNKNOWN',
        lastCheckedAt: new Date(), lastCheckError: null,
      },
      create: {
        integrationId, externalId: item.externalId, productId, title: item.title,
        sourceUrl: item.sourceUrl ?? null, rawData: item.rawData as any, lastSourceCost: cost,
        sourceAvailability: provider === 'SHOPIFY' ? (Number(raw.totalInventory ?? 0) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK') : 'UNKNOWN',
        lastCheckedAt: new Date(),
      },
    });

    await db.marketplaceImportLog.create({
      data: {
        integrationId, productId, externalId: item.externalId, sourceUrl: item.sourceUrl ?? null,
        title: item.title, status: action, automatic: Boolean(settings.automatic),
        sourceCost: cost, sellingPrice: sellingPrice || null, importedImages,
      },
    });
  }
  return { imported, updated, skipped };
}
async function amazonItems(settings: Settings, credentials: Record<string, unknown>): Promise<SyncItem[]> {
  const mod: any = await import('amazon-sp-api');
  const SellingPartner = mod.SellingPartner ?? mod.default;
  const client = new SellingPartner({
    region: String(credentials.region ?? process.env.AMAZON_SP_API_REGION ?? 'eu'),
    refresh_token: String(credentials.refreshToken ?? process.env.AMAZON_SP_API_REFRESH_TOKEN ?? ''),
    credentials: {
      SELLING_PARTNER_APP_CLIENT_ID: String(credentials.clientId ?? process.env.AMAZON_SP_API_CLIENT_ID ?? ''),
      SELLING_PARTNER_APP_CLIENT_SECRET: String(credentials.clientSecret ?? process.env.AMAZON_SP_API_CLIENT_SECRET ?? ''),
    },
  });
  const keywords = settings.query || process.env.AMAZON_SP_API_IMPORT_KEYWORDS || 'electronics';
  const marketplaceId = String(credentials.marketplaceId ?? process.env.AMAZON_SP_API_MARKETPLACE_ID ?? 'A21TJRUUN4KGV');
  const response = await client.callAPI({
    operation: 'searchCatalogItems',
    endpoint: 'catalogItems',
    query: { marketplaceIds: [marketplaceId], keywords, pageSize: Math.min(20, Number(settings.maxItemsPerSync ?? 20)) },
  });
  const items = response?.items ?? response?.payload?.items ?? [];
  return items.map((x: any) => ({
    externalId: String(x.asin || x.itemId || x.identifiers?.marketplaceASIN?.asin),
    title: x.summaries?.[0]?.itemName || x.title || 'Amazon product',
    sourceUrl: x.asin ? `https://www.amazon.in/dp/${x.asin}` : null,
    sourceCost: Number(x.offers?.[0]?.price?.amount ?? 0) || null,
    imageUrl: x.images?.[0]?.images?.[0]?.link || x.images?.[0]?.link || null,
    rawData: x,
  })).filter((x: SyncItem) => x.externalId);
}

async function flipkartItems(settings: Settings, credentials: Record<string, unknown>): Promise<SyncItem[]> {
  const tokenResponse = await fetch('https://api.flipkart.net/oauth-service/oauth/token?grant_type=client_credentials&scope=Seller_Api,Default', {
    headers: { Authorization: `Basic ${Buffer.from(`${credentials.apiKey ?? process.env.FLIPKART_SELLER_API_KEY ?? ''}:${credentials.apiSecret ?? process.env.FLIPKART_SELLER_API_SECRET ?? ''}`).toString('base64')}` },
    cache: 'no-store',
  });
  if (!tokenResponse.ok) throw new Error(`Flipkart token request failed (${tokenResponse.status})`);
  const token = (await tokenResponse.json()).access_token;
  const response = await fetch('https://api.flipkart.net/sellers/v3/listings/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filters: { listing_status: 'ACTIVE' }, page_id: null }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Flipkart listing request failed (${response.status})`);
  const data: any = await response.json();
  const rows = data.listingData ?? data.listings ?? [];
  return rows.map((x: any) => ({
    externalId: String(x.sku || x.sku_id || x.listing_id),
    title: x.product_name || x.title || 'Flipkart product',
    sourceUrl: x.listing_url || null,
    sourceCost: Number(x.product_description?.ssp ?? x.price?.selling_price ?? 0) || null,
    imageUrl: x.product_image_url || null,
    rawData: x,
  })).filter((x: SyncItem) => x.externalId);
}


async function shopifyItems(settings: Settings, credentials: Record<string, unknown>): Promise<SyncItem[]> {
  const { domain, accessToken } = await getShopifyAccessToken(credentials);
  const query = `query { products(first: 100) { nodes { id title descriptionHtml onlineStoreUrl totalInventory images(first: 1) { nodes { url } } variants(first: 1) { nodes { price } } } } }`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`https://${domain}/admin/api/2026-07/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
      body: JSON.stringify({ query }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Shopify request failed (${response.status})`);
    const data: any = await response.json();
    if (data.errors?.length) throw new Error(data.errors.map((e: any) => e.message).join('; '));
    return (data.data?.products?.nodes ?? []).map((x: any) => ({
      externalId: x.id,
      title: x.title,
      sourceUrl: x.onlineStoreUrl || null,
      sourceCost: Number(x.variants?.nodes?.[0]?.price ?? 0) || null,
      imageUrl: x.images?.nodes?.[0]?.url || null,
      rawData: x,
    }));
  } finally { clearTimeout(timer); }
}

async function etsyItems(credentials: Record<string, unknown>): Promise<SyncItem[]> {
  const response = await fetch(`https://api.etsy.com/v3/application/shops/${String(credentials.shopId ?? process.env.ETSY_SHOP_ID ?? '')}/listings/active?limit=100&includes=Images`, {
    headers: {
      'x-api-key': `${credentials.apiKeyString ?? process.env.ETSY_API_KEYSTRING ?? ''}:${credentials.sharedSecret ?? process.env.ETSY_API_SHARED_SECRET ?? ''}`,
      Authorization: `Bearer ${String(credentials.accessToken ?? process.env.ETSY_ACCESS_TOKEN ?? '')}`,
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Etsy request failed (${response.status})`);
  const data: any = await response.json();
  return (data.results ?? []).map((x: any) => ({
    externalId: String(x.listing_id),
    title: x.title || 'Etsy product',
    sourceUrl: x.url || (x.listing_id ? `https://www.etsy.com/listing/${x.listing_id}` : null),
    sourceCost: Number(x.price?.amount && x.price?.divisor ? x.price.amount / x.price.divisor : 0) || null,
    imageUrl: x.images?.[0]?.url_fullxfull || x.images?.[0]?.url_570xN || null,
    rawData: x,
  }));
}

async function ebayItems(settings: Settings, credentials: Record<string, unknown>): Promise<SyncItem[]> {
  const production = String(credentials.environment ?? process.env.EBAY_ENV ?? 'production') !== 'sandbox';
  const base = production ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com';
  const auth = await fetch(`${base}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.clientId ?? process.env.EBAY_CLIENT_ID ?? ''}:${credentials.clientSecret ?? process.env.EBAY_CLIENT_SECRET ?? ''}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    cache: 'no-store',
  });
  if (!auth.ok) throw new Error(`eBay token request failed (${auth.status})`);
  const token = (await auth.json()).access_token;
  const query = settings.query || process.env.EBAY_IMPORT_QUERY || 'electronics';
  const response = await fetch(`${base}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=100`, {
    headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': String(credentials.marketplaceId ?? process.env.EBAY_MARKETPLACE_ID ?? 'EBAY-US') },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`eBay Browse request failed (${response.status})`);
  const data: any = await response.json();
  return (data.itemSummaries ?? []).map((x: any) => ({
    externalId: String(x.itemId),
    title: x.title || 'eBay product',
    sourceUrl: x.itemWebUrl || null,
    sourceCost: Number(x.price?.value ?? 0) || null,
    imageUrl: x.image?.imageUrl || null,
    rawData: x,
  }));
}

export async function syncMarketplace(integrationId: string, provider: string, rawSettings: unknown) {
  const settings = settingsOf(rawSettings);
  const credentials = await marketplaceCredentials(provider);
  if (!(await credentialStatus(provider))) throw new Error('Required official API credentials are not configured.');
  if (!providerCapabilities(provider).products) throw new Error(providerCapabilities(provider).note);

  let items: SyncItem[] = [];
  switch (provider) {
    case 'AMAZON': items = await amazonItems(settings, credentials); break;
    case 'FLIPKART': items = await flipkartItems(settings, credentials); break;
    case 'SHOPIFY': items = await shopifyItems(settings, credentials); break;
    case 'ETSY': items = await etsyItems(credentials); break;
    case 'EBAY': items = await ebayItems(settings, credentials); break;
    case 'MEESHO': throw new Error('Meesho official partner API access is required; scraping is intentionally disabled.');
    default: throw new Error('Unsupported marketplace provider.');
  }

  const importResult = await importItems(integrationId, provider, items, { ...settings, automatic: true, changedBy: 'MARKETPLACE_SYNC' });
  return {
    importedProducts: importResult.imported,
    updatedProducts: importResult.updated,
    skippedProducts: importResult.skipped,
    importedOrders: 0,
    found: items.length,
  };
}
