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
  for (const item of items.slice(0, Math.max(1, Number(settings.maxItemsPerSync ?? 100)))) {
    const raw = item.rawData && typeof item.rawData === 'object' ? item.rawData as any : {};
    const cost = item.sourceCost && item.sourceCost > 0 ? item.sourceCost : null;
    const sellingPrice = priceWithMarkup(cost, settings);
    const existing = await db.marketplaceProduct.findUnique({
      where: { integrationId_externalId: { integrationId, externalId: item.externalId } },
    });

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
    }

    await db.marketplaceProduct.upsert({
      where: { integrationId_externalId: { integrationId, externalId: item.externalId } },
      update: { productId, title: item.title, sourceUrl: item.sourceUrl ?? null, rawData: item.rawData as any },
      create: { integrationId, externalId: item.externalId, productId, title: item.title, sourceUrl: item.sourceUrl ?? null, rawData: item.rawData as any },
    });

    if (productId && provider === 'SHOPIFY' && Array.isArray(raw.images?.nodes)) {
      const urls = raw.images.nodes.map((x: any) => String(x?.url || '')).filter(Boolean);
      for (const url of urls.slice(0, 20)) {
        const exists = await db.productImage.findFirst({ where: { productId, url } });
        if (!exists) await db.productImage.create({ data: { productId, url, altText: item.title } });
      }
    } else if (item.imageUrl && productId) {
      const image = await db.productImage.findFirst({ where: { productId } });
      if (!image) await db.productImage.create({ data: { productId, url: item.imageUrl, altText: item.title } });
    }
  }
  return { imported, updated, skipped };
}
