import { scrapeMarketplaceProduct } from './marketplace-scraper';
import { getShopifyAccessToken } from './shopify';
import { getScrapingBeeApiKey } from './scrapingbee';

export type MeeshoAutoSettings = {
  maxItemsPerSync?: number;
  keywords?: string;
  categories?: string;
  shardCountPerRun?: number;
  shardCursor?: number;
  sitemapShards?: string[];
  sitemapFetchedAt?: string;
  importStatus?: 'DRAFT' | 'ACTIVE';
  markupPercent?: number;
  fixedAmount?: number;
  importImages?: boolean;
  importDescriptions?: boolean;
};

const SITEMAP_INDEX = 'https://www.meesho.com/sitemap.xml';
const DEFAULT_SHARD_COUNT = 1;
const DEFAULT_MAX_ITEMS = 10;

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function parseLocs(xml: string) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m => m[1].trim()).filter(Boolean);
}

function extractProductUrls(text: string) {
  const urls = new Set<string>();
  const decoded = text
    .replace(/\\u002F/g, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');

  const candidates = decoded.match(/https?:\\/\\/(?:www\\.)?meesho\\.com[^\\s"'<>]+/gi) ?? [];
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate.replace(/[),.;]+$/, ''));
      if (/\\/(?:s\\/)?p\\/[a-z0-9]+(?:$|\\?|#)/i.test(url.pathname)
        || /\\/[^/]+\\/p\\/[a-z0-9]+(?:$|\\?|#)/i.test(url.pathname)) {
        url.search = '';
        url.hash = '';
        urls.add(url.toString());
      }
    } catch {}
  }

  for (const match of decoded.matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1], 'https://www.meesho.com');
      if (url.hostname.endsWith('meesho.com')
        && (/\\/(?:s\\/)?p\\/[a-z0-9]+(?:$|\\?|#)/i.test(url.pathname)
          || /\\/[^/]+\\/p\\/[a-z0-9]+(?:$|\\?|#)/i.test(url.pathname))) {
        url.search = '';
        url.hash = '';
        urls.add(url.toString());
      }
    } catch {}
  }

  return [...urls];
}

async function scrapingBee(url: string, timeoutMs = 60000) {
  const key = getScrapingBeeApiKey();
  if (!key) throw new Error('Add SCRAPINGBEE_API_KEY in Vercel before enabling Meesho Auto Import.');

  const endpoint = new URL('https://app.scrapingbee.com/api/v1/');
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('mode', 'auto');
  endpoint.searchParams.set('country_code', 'in');
  endpoint.searchParams.set('max_cost', (process.env.SCRAPINGBEE_MAX_COST ?? '75').trim() || '75');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint.toString(), {
      headers: { Authorization: 'Bearer ' + key, Accept: 'text/html,application/xml' },
      cache: 'no-store',
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) throw new Error('ScrapingBee returned HTTP ' + response.status + '.');
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function loadSitemapShards(settings: MeeshoAutoSettings) {
  const cached = Array.isArray(settings.sitemapShards) ? settings.sitemapShards.filter(Boolean) : [];
  const freshAt = settings.sitemapFetchedAt ? Date.parse(settings.sitemapFetchedAt) : 0;
  if (cached.length && Number.isFinite(freshAt) && Date.now() - freshAt < 24 * 60 * 60 * 1000) return cached;

  const xml = await scrapingBee(SITEMAP_INDEX);
  const shards = parseLocs(xml).filter(url => /\/sitemap\/pdp\//i.test(url));
  if (!shards.length) throw new Error('Meesho sitemap did not return product shards.');
  return shards;
}

function matchesFilters(item: { name: string; categoryName?: string }, settings: MeeshoAutoSettings) {
  const keywords = clean(settings.keywords).split(',').map(x => x.toLowerCase()).filter(Boolean);
  const categories = clean(settings.categories).split(',').map(x => x.toLowerCase()).filter(Boolean);
  const haystack = (item.name + ' ' + clean(item.categoryName)).toLowerCase();

  if (keywords.length && !keywords.some(k => haystack.includes(k))) return false;
  if (categories.length && !categories.some(k => clean(item.categoryName).toLowerCase().includes(k))) return false;
  return true;
}

export async function discoverMeeshoAutoProducts(settings: MeeshoAutoSettings) {
  const maxItems = Math.max(1, Math.min(50, Number(settings.maxItemsPerSync ?? DEFAULT_MAX_ITEMS)));
  const keyword = clean(settings.keywords);
  const keywordTokens = keyword
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(token => token.trim())
    .filter(token => token.length >= 2);

  const shards = await loadSitemapShards(settings);
  const cursor = Math.max(0, Number(settings.shardCursor ?? 0)) % shards.length;
  const configuredShardCount = Math.max(
    1,
    Math.min(10, Number(settings.shardCountPerRun ?? DEFAULT_SHARD_COUNT)),
  );

  const selected: string[] = [];
  const urls: string[] = [];
  let shardOffset = 0;

  // Meesho's public search page does not expose its product grid reliably.
  // Use the product sitemap as the discovery index, then filter product slugs
  // by the requested keyword before spending credits on individual pages.
  for (
    ;
    shardOffset < Math.min(configuredShardCount, shards.length) && urls.length < maxItems * 4;
    shardOffset++
  ) {
    const shard = shards[(cursor + shardOffset) % shards.length];
    selected.push(shard);

    try {
      const shardUrls = parseLocs(await scrapingBee(shard))
        .filter(url => /^https?:\\/\\/(?:www\\.)?meesho\\.com\\/[^?#]+\\/p\\/[a-z0-9]+(?:[?#]|$)/i.test(url));

      const matched = keywordTokens.length
        ? shardUrls.filter(url => {
            try {
              const path = decodeURIComponent(new URL(url).pathname).toLowerCase();
              const haystack = path.replace(/[-_]+/g, ' ');
              return keywordTokens.some(token => haystack.includes(token));
            } catch {
              return false;
            }
          })
        : shardUrls;

      urls.push(...matched);
    } catch {
      // Continue to the next shard; one unavailable sitemap shard must not
      // stop the whole import.
    }
  }

  const uniqueUrls = [...new Set(urls)]
    .slice(0, Math.min(100, Math.max(maxItems * 4, maxItems)));

  const products: Array<{
    externalId: string;
    title: string;
    sourceUrl: string;
    sourceCost: number;
    imageUrl: string | null;
    rawData: Record<string, unknown>;
  }> = [];
  let failed = 0;
  const failureDetails: string[] = [];

  for (const url of uniqueUrls) {
    if (products.length >= maxItems) break;

    try {
      const item = await scrapeMarketplaceProduct(url);
      if (item.provider !== 'MEESHO' || !matchesFilters(item, settings)) continue;

      products.push({
        externalId: item.externalId,
        title: item.name,
        sourceUrl: item.sourceUrl,
        sourceCost: item.sourceCost,
        imageUrl: item.images[0] ?? null,
        rawData: {
          descriptionHtml: item.description
            ? '<p>' + item.description.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\n/g, '<br>') + '</p>'
            : '',
          images: item.images,
          categoryName: item.categoryName ?? '',
          availability: item.availability,
        },
      });
    } catch (error) {
      failed++;
      if (failureDetails.length < 3) {
        failureDetails.push(error instanceof Error ? error.message.slice(0, 1000) : 'Product scrape failed.');
      }
    }
  }

  if (!products.length && !failed) {
    failureDetails.push(
      keyword
        ? 'No matching Meesho products were found in the scanned sitemap shard(s). Try the import again; the importer advances to the next shard.'
        : 'No Meesho product URLs were found in the scanned sitemap shard(s).',
    );
  }

  return {
    products,
    shardCursor: (cursor + Math.max(1, selected.length)) % shards.length,
    sitemapShards: shards,
    sitemapFetchedAt: settings.sitemapFetchedAt ?? new Date().toISOString(),
    shardsScanned: selected.length,
    urlsScanned: uniqueUrls.length,
    failed,
    failureDetails,
  };
}

function sellingPrice(cost: number, settings: MeeshoAutoSettings) {
  const markup = Number(settings.markupPercent ?? 0);
  const fixed = Number(settings.fixedAmount ?? 0);
  const value = cost * (1 + markup / 100) + fixed;
  return Math.max(0.01, Math.round(value * 100) / 100);
}

export async function importMeeshoProductsToShopify(products: Awaited<ReturnType<typeof discoverMeeshoAutoProducts>>['products'], settings: MeeshoAutoSettings) {
  const credentials = {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN ?? '',
    clientId: process.env.SHOPIFY_CLIENT_ID ?? '',
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET ?? '',
  };
  const { domain, accessToken } = await getShopifyAccessToken(credentials);
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const product of products) {
    try {
      const handle = 'zenvora-meesho-' + product.externalId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const files = settings.importImages === false ? [] : product.rawData.images && Array.isArray(product.rawData.images)
        ? (product.rawData.images as string[]).slice(0, 8).map((url, index) => ({
            originalSource: url,
            alt: product.title,
            filename: handle + '-' + (index + 1) + '.avif',
            contentType: 'IMAGE',
          }))
        : [];

      const input = {
        title: product.title,
        handle,
        descriptionHtml: settings.importDescriptions === false ? undefined : product.rawData.descriptionHtml,
        productType: clean(product.rawData.categoryName) || 'Meesho',
        vendor: 'Zenvora',
        status: settings.importStatus ?? 'DRAFT',
        files,
        metafields: [
          { namespace: 'zenvora', key: 'source', type: 'single_line_text_field', value: 'meesho' },
          { namespace: 'zenvora', key: 'source_id', type: 'single_line_text_field', value: product.externalId },
          { namespace: 'zenvora', key: 'source_url', type: 'url', value: product.sourceUrl },
          { namespace: 'zenvora', key: 'source_cost', type: 'number_decimal', value: String(product.sourceCost) },
        ],
        variants: [{ price: sellingPrice(product.sourceCost, settings) }],
      };

      const query = `mutation UpsertMeeshoProduct($input: ProductSetInput!, $identifier: ProductSetIdentifiers) {
        productSet(input: $input, identifier: $identifier) {
          product { id }
          userErrors { field message }
        }
      }`;

      const response = await fetch('https://' + domain + '/admin/api/2026-07/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
        body: JSON.stringify({ query, variables: { input, identifier: { handle } } }),
        cache: 'no-store',
      });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok || data.errors?.length || data.data?.productSet?.userErrors?.length) {
        const message = data.data?.productSet?.userErrors?.map((e: any) => e.message).join('; ') || data.errors?.map((e: any) => e.message).join('; ') || 'Shopify product import failed.';
        throw new Error(message);
      }

      const existed = Boolean(data.data?.productSet?.product?.id && data.data.productSet.product.id);
      if (existed) updated++;
      else created++;
    } catch {
      failed++;
    }
  }

  return { created, updated, failed, total: products.length };
}
