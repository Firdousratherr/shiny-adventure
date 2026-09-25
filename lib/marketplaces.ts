import { db } from './db';
import { decryptMarketplaceCredentials } from './marketplace-crypto';
import { getShopifyAccessToken } from './shopify';
import { discoverMeeshoAutoProducts } from './meesho-auto-import';

export type SyncItem = {
  externalId: string;
  title: string;
  sourceUrl?: string | null;
  sourceCost?: number | null;
  imageUrl?: string | null;
  rawData?: unknown;
};

export type ImportMode = 'CREATE_ONLY' | 'UPDATE_ONLY' | 'CREATE_AND_UPDATE';

type Settings = {
  markupPercent?: number;
  fixedAmount?: number;
  maxItemsPerSync?: number;
  syncProducts?: boolean;
  syncOrders?: boolean;
  syncInventory?: boolean;
  query?: string;
  automatic?: boolean;
  mode?: ImportMode;
  skipExisting?: boolean;
  skipOutOfStock?: boolean;
  skipWithoutImages?: boolean;
  skipWithoutPrice?: boolean;
  minSourcePrice?: number;
  maxSourcePrice?: number;
  minInventory?: number;
  roundingMode?: 'NONE' | 'NEAREST' | 'UP' | 'DOWN';
  roundingValue?: number;
  minSellingPrice?: number;
  maxSellingPrice?: number;
  protectLockedPrice?: boolean;
  updatePrice?: boolean;
  importImages?: boolean;
  importDescriptions?: boolean;
  importInventory?: boolean;
  changedBy?: string;
  categoryMappings?: Record<string, string>;
  keywords?: string;
  categories?: string;
  shardCountPerRun?: number;
  shardCursor?: number;
  sitemapShards?: string[];
  sitemapFetchedAt?: string;
  importStatus?: 'DRAFT' | 'ACTIVE';
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
    MEESHO: { products: true, orders: false, inventory: false, note: 'Public catalogue discovery via ScrapingBee; supplier/order APIs are not used.' },
    EBAY: { products: true, orders: false, inventory: false, note: 'eBay Browse API catalog import' },
    ETSY: { products: true, orders: true, inventory: true, note: 'Etsy Open API v3' },
    SHOPIFY: { products: true, orders: true, inventory: true, note: 'Shopify Admin GraphQL API' },
  }[provider] ?? { products: false, orders: false, inventory: false, note: 'Unsupported provider' };
}

function settingsOf(value: unknown): Settings {
  if (!value || typeof value !== 'object') return {};
  return value as Settings;
}

function numeric(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeImageUrls(provider: string, raw: any, fallback?: string | null) {
  const candidates = provider === 'SHOPIFY' && Array.isArray(raw?.images?.nodes)
    ? raw.images.nodes.map((x: any) => x?.url)
    : provider === 'MEESHO' && Array.isArray(raw?.images)
      ? [...raw.images, fallback]
      : [fallback];

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (!value || seen.has(value)) continue;
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) continue;
      if (/placeholder|placehold|no[-_ ]?image|default[-_ ]?image|coming[-_ ]?soon/i.test(value)) continue;
      seen.add(value);
      urls.push(value);
    } catch {
      // Ignore malformed image URLs from third-party catalogs.
    }
    if (urls.length >= 20) break;
  }
  return urls;
}

function priceWithMarkup(cost: number | null | undefined, settings: Settings) {
  if (!cost || cost <= 0) return 0;
  const markup = numeric(settings.markupPercent) ?? 0;
  const fixed = numeric(settings.fixedAmount) ?? 0;
  let price = cost * (1 + markup / 100) + fixed;

  const step = numeric(settings.roundingValue);
  if (step && step > 0 && settings.roundingMode && settings.roundingMode !== 'NONE') {
    if (settings.roundingMode === 'UP') price = Math.ceil(price / step) * step;
    else if (settings.roundingMode === 'DOWN') price = Math.floor(price / step) * step;
    else price = Math.round(price / step) * step;
  }

  const minPrice = numeric(settings.minSellingPrice);
  const maxPrice = numeric(settings.maxSellingPrice);
  if (minPrice !== null && minPrice >= 0) price = Math.max(price, minPrice);
  if (maxPrice !== null && maxPrice >= 0) price = Math.min(price, maxPrice);
  return Math.round(price * 100) / 100;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70) || 'product';
}

type ExistingState = {
  productId?: string | null;
  product?: {
    id: string;
    sellingPrice: unknown;
    priceLocked: boolean;
    priceLockValue: unknown;
    _count?: { images: number };
  } | null;
};

function evaluateImportItem(
  provider: string,
  item: SyncItem,
  existing: ExistingState | null | undefined,
  settings: Settings,
) {
  const raw = item.rawData && typeof item.rawData === 'object' ? item.rawData as any : {};
  const costNumber = numeric(item.sourceCost);
  const cost = costNumber !== null && costNumber > 0 ? costNumber : null;
  const inventory = provider === 'SHOPIFY' ? Math.max(0, numeric(raw.totalInventory) ?? 0) : null;
  const imageUrls = normalizeImageUrls(provider, raw, item.imageUrl);
  const hasExistingProduct = Boolean(existing?.productId);
  const mode: ImportMode = settings.mode ?? 'CREATE_AND_UPDATE';
  const currentSellingPrice = numeric(existing?.product?.sellingPrice);
  const lockedPrice = settings.protectLockedPrice !== false && existing?.product?.priceLocked
    ? numeric(existing?.product?.priceLockValue)
    : null;

  let proposedSellingPrice = priceWithMarkup(cost, settings);
  if (lockedPrice !== null) proposedSellingPrice = lockedPrice;
  else if (hasExistingProduct && settings.updatePrice === false) proposedSellingPrice = currentSellingPrice ?? proposedSellingPrice;

  let action: 'CREATE' | 'UPDATE' | 'SKIP' = hasExistingProduct ? 'UPDATE' : 'CREATE';
  let reason = '';

  if (hasExistingProduct && (settings.skipExisting || mode === 'CREATE_ONLY')) {
    action = 'SKIP'; reason = 'Already imported';
  } else if (!hasExistingProduct && mode === 'UPDATE_ONLY') {
    action = 'SKIP'; reason = 'Not previously imported';
  } else if (settings.skipOutOfStock && inventory !== null && inventory <= 0) {
    action = 'SKIP'; reason = 'Out of stock';
  } else if (settings.skipWithoutImages && imageUrls.length === 0) {
    action = 'SKIP'; reason = 'No usable images';
  } else if (settings.skipWithoutPrice && cost === null) {
    action = 'SKIP'; reason = 'No source price';
  } else if (numeric(settings.minSourcePrice) !== null && (cost === null || (cost as number) < (numeric(settings.minSourcePrice) as number))) {
    action = 'SKIP'; reason = 'Source price below minimum';
  } else if (numeric(settings.maxSourcePrice) !== null && cost !== null && cost > (numeric(settings.maxSourcePrice) as number)) {
    action = 'SKIP'; reason = 'Source price above maximum';
  } else if (numeric(settings.minInventory) !== null && inventory !== null && inventory < (numeric(settings.minInventory) as number)) {
    action = 'SKIP'; reason = 'Inventory below minimum';
  }

  return {
    raw,
    cost,
    inventory,
    imageUrls,
    hasExistingProduct,
    currentSellingPrice,
    proposedSellingPrice,
    action,
    reason,
  };
}

export type ImportPreviewRow = {
  externalId: string;
  title: string;
  sourceCost: number | null;
  currentSellingPrice: number | null;
  proposedSellingPrice: number;
  inventory: number | null;
  imageCount: number;
  existingImages: number;
  action: 'CREATE' | 'UPDATE' | 'SKIP';
  reason: string;
  lockedPrice: boolean;
};

export async function previewItems(
  integrationId: string,
  provider: string,
  items: SyncItem[],
  settings: Settings,
): Promise<ImportPreviewRow[]> {
  const limitedItems = items.slice(0, Math.max(1, Math.min(100, Number(settings.maxItemsPerSync ?? items.length))));
  const existingRows = await db.marketplaceProduct.findMany({
    where: { integrationId, externalId: { in: limitedItems.map(x => x.externalId) } },
    include: {
      product: {
        select: {
          id: true,
          sellingPrice: true,
          priceLocked: true,
          priceLockValue: true,
          _count: { select: { images: true } },
        },
      },
    },
  });
  const existingMap = new Map(existingRows.map(row => [row.externalId, row]));
  return limitedItems.map(item => {
    const existing = existingMap.get(item.externalId);
    const result = evaluateImportItem(provider, item, existing, settings);
    return {
      externalId: item.externalId,
      title: item.title,
      sourceCost: result.cost,
      currentSellingPrice: result.currentSellingPrice,
      proposedSellingPrice: result.proposedSellingPrice,
      inventory: result.inventory,
      imageCount: result.imageUrls.length,
      existingImages: existing?.product?._count?.images ?? 0,
      action: result.action,
      reason: result.reason,
      lockedPrice: Boolean(existing?.product?.priceLocked),
    };
  });
}

export async function importItems(integrationId: string, provider: string, items: SyncItem[], settings: Settings) {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const limit = Math.max(1, Math.min(500, Number(settings.maxItemsPerSync ?? items.length)));

  const existingRows = await db.marketplaceProduct.findMany({
    where: { integrationId, externalId: { in: items.slice(0, limit).map(x => x.externalId) } },
    include: {
      product: {
        select: {
          id: true,
          sellingPrice: true,
          priceLocked: true,
          priceLockValue: true,
          _count: { select: { images: true } },
        },
      },
    },
  });
  const existingMap = new Map(existingRows.map(row => [row.externalId, row]));

  for (const item of items.slice(0, limit)) {
    try {
      const existing = existingMap.get(item.externalId);
    const evaluated = evaluateImportItem(provider, item, existing, settings);
    const raw = evaluated.raw;
    const cost = evaluated.cost;
    const sellingPrice = evaluated.proposedSellingPrice;

    if (evaluated.action === 'SKIP') {
      skipped++;
      await db.marketplaceImportLog.create({
        data: {
          integrationId,
          productId: existing?.productId ?? null,
          externalId: item.externalId,
          sourceUrl: item.sourceUrl ?? null,
          title: item.title,
          status: 'SKIPPED',
          automatic: Boolean(settings.automatic),
          sourceCost: cost,
          sellingPrice: sellingPrice || null,
          importedImages: 0,
          error: evaluated.reason || null,
        },
      });
      continue;
    }

    const collections = Array.isArray(raw.collections?.nodes) ? raw.collections.nodes : [];
    const categoryName = provider === 'SHOPIFY'
      ? String(collections[0]?.title || raw.productType || '').trim()
      : '';
    const mappedCategoryId = provider === 'SHOPIFY' && settings.categoryMappings
      ? collections.map((x: any) => String(x?.handle || '').trim()).map((key: string) => settings.categoryMappings?.[key]).find(Boolean)
        || settings.categoryMappings[categoryName]
        || settings.categoryMappings[String(raw.productType || '').trim()]
      : undefined;
    let categoryId: string | null = mappedCategoryId ? String(mappedCategoryId) : null;
    if (!categoryId && categoryName) {
      const slug = slugify(categoryName);
      const category = await db.category.upsert({
        where: { slug },
        update: {},
        create: { name: categoryName, slug },
      });
      categoryId = category.id;
    }

    let productId = existing?.productId ?? null;
    let action: 'CREATED' | 'UPDATED' = evaluated.action === 'CREATE' ? 'CREATED' : 'UPDATED';

    if (!productId) {
      const baseSlug = slugify(item.title);
      let slug = baseSlug;
      for (let n = 2; ; n++) {
        const clash = await db.product.findUnique({ where: { slug } });
        if (!clash) break;
        slug = baseSlug + '-' + provider.toLowerCase() + '-' + n;
      }
      const product = await db.product.create({
        data: {
          name: item.title,
          slug,
          description: settings.importDescriptions === false
            ? null
            : String(raw.descriptionHtml || '') || null,
          sourceUrl: item.sourceUrl ?? null,
          sourceCost: cost,
          sellingPrice: sellingPrice || 0,
          stock: settings.importInventory === false ? 0 : (provider === 'SHOPIFY' ? Number(raw.totalInventory ?? 0) || 0 : 0),
          categoryId,
          status: provider === 'MEESHO' && settings.importStatus === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
        },
      });
      productId = product.id;
      imported++;
    } else {
      const oldSellingPrice = Number(existing?.product?.sellingPrice ?? 0);
      const updateData: Record<string, unknown> = {
        name: item.title,
        sourceUrl: item.sourceUrl ?? undefined,
        sourceCost: cost,
      };
      if (provider === 'SHOPIFY') {
        if (settings.importDescriptions !== false) updateData.description = String(raw.descriptionHtml || '') || null;
        if (settings.importInventory !== false) updateData.stock = Number(raw.totalInventory ?? 0) || 0;
      }
      if (categoryId) updateData.categoryId = categoryId;
      if (settings.updatePrice !== false && !(settings.protectLockedPrice !== false && existing?.product?.priceLocked)) {
        if (sellingPrice > 0) updateData.sellingPrice = sellingPrice;
      }
      await db.product.update({ where: { id: productId }, data: updateData as any });
      updated++;
      const newSellingPrice = settings.updatePrice !== false && !(settings.protectLockedPrice !== false && existing?.product?.priceLocked)
        ? sellingPrice
        : oldSellingPrice;
      if (newSellingPrice > 0 && oldSellingPrice !== newSellingPrice) {
        await db.productPriceHistory.create({
          data: {
            productId,
            sourceCost: cost,
            oldSellingPrice,
            newSellingPrice,
            markupPercent: Number(settings.markupPercent ?? 0),
            reason: 'MARKETPLACE_IMPORT',
            changedBy: settings.changedBy ?? 'MARKETPLACE_IMPORT',
          },
        });
      }
    }

    let importedImages = 0;
    if (productId && settings.importImages !== false) {
      for (const url of evaluated.imageUrls) {
        const existsImage = await db.productImage.findFirst({ where: { productId, url } });
        if (!existsImage) {
          await db.productImage.create({
            data: { productId, url, altText: item.title, sortOrder: (existing?.product?._count?.images ?? 0) + importedImages },
          });
          importedImages++;
        }
      }
    }

    await db.marketplaceProduct.upsert({
      where: { integrationId_externalId: { integrationId, externalId: item.externalId } },
      update: {
        productId,
        title: item.title,
        sourceUrl: item.sourceUrl ?? null,
        rawData: item.rawData as any,
        lastSourceCost: cost,
        sourceAvailability: provider === 'SHOPIFY' ? (Number(raw.totalInventory ?? 0) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK') : 'UNKNOWN',
        lastCheckedAt: new Date(),
        lastCheckError: null,
      },
      create: {
        integrationId,
        externalId: item.externalId,
        productId,
        title: item.title,
        sourceUrl: item.sourceUrl ?? null,
        rawData: item.rawData as any,
        lastSourceCost: cost,
        sourceAvailability: provider === 'SHOPIFY' ? (Number(raw.totalInventory ?? 0) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK') : 'UNKNOWN',
        lastCheckedAt: new Date(),
      },
    });

    await db.marketplaceImportLog.create({
      data: {
        integrationId,
        productId,
        externalId: item.externalId,
        sourceUrl: item.sourceUrl ?? null,
        title: item.title,
        status: action,
        automatic: Boolean(settings.automatic),
        sourceCost: cost,
        sellingPrice: sellingPrice || null,
        importedImages,
      },
    });
    } catch (error) {
      failed++;
      await db.marketplaceImportLog.create({
        data: {
          integrationId,
          productId: existingMap.get(item.externalId)?.productId ?? null,
          externalId: item.externalId,
          sourceUrl: item.sourceUrl ?? null,
          title: item.title,
          status: 'FAILED',
          automatic: Boolean(settings.automatic),
          sourceCost: numeric(item.sourceCost),
          sellingPrice: null,
          importedImages: 0,
          error: error instanceof Error ? error.message.slice(0, 1000) : 'Marketplace import failed.',
        },
      });
    }
  }
  return { imported, updated, skipped, failed };
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
  const query = `query { products(first: 100) { nodes { id title descriptionHtml onlineStoreUrl totalInventory images(first: 20) { nodes { url } } variants(first: 1) { nodes { price } } } } }`;
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
    const raw = await response.text();
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Shopify returned a non-JSON response (${response.status}).`); }
    if (data.errors) {
      const detail = Array.isArray(data.errors)
        ? data.errors.map((e: any) => String(e?.message || e)).join('; ')
        : typeof data.errors === 'object'
          ? Object.values(data.errors as Record<string, unknown>).map((e: any) => String(e?.message || e)).join('; ')
          : String(data.errors);
      throw new Error(detail || `Shopify GraphQL request failed (${response.status}).`);
    }
    if (!response.ok) throw new Error(`Shopify request failed (${response.status})${data?.error ? ': ' + String(data.error) : ''}`);
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

  if (provider === 'MEESHO') {
    const discovery = await discoverMeeshoAutoProducts(settings);
    const items: SyncItem[] = discovery.products.map(product => ({
      externalId: product.externalId,
      title: product.title,
      sourceUrl: product.sourceUrl,
      sourceCost: product.sourceCost,
      imageUrl: product.imageUrl,
      rawData: product.rawData,
    }));
    const result = await importItems(integrationId, 'MEESHO', items, { ...settings, automatic: true, changedBy: settings.changedBy ?? 'MEESHO_AUTO_IMPORT' });
    const nextSettings = {
      ...(settings as Record<string, unknown>),
      shardCursor: discovery.shardCursor,
      sitemapShards: discovery.sitemapShards,
      sitemapFetchedAt: discovery.sitemapFetchedAt,
    };
    await db.marketplaceIntegration.update({ where: { id: integrationId }, data: { settings: nextSettings as any } });
    return {
      importedProducts: result.imported + result.updated,
      updatedProducts: result.updated,
      skippedProducts: result.skipped,
      failedProducts: result.failed + discovery.failed,
      importedOrders: 0,
      found: discovery.products.length,
      shardsScanned: discovery.shardsScanned,
      urlsScanned: discovery.urlsScanned,
    };
  }

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
    case 'MEESHO': throw new Error('Meesho is handled by the automatic importer above.');
    default: throw new Error('Unsupported marketplace provider.');
  }

  const importResult = await importItems(integrationId, provider, items, { ...settings, automatic: true, changedBy: 'MARKETPLACE_SYNC' });
  return {
    importedProducts: importResult.imported,
    updatedProducts: importResult.updated,
    skippedProducts: importResult.skipped,
    failedProducts: importResult.failed,
    importedOrders: 0,
    found: items.length,
  };
}
