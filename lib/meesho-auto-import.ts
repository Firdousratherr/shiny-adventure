import { scrapeMarketplaceProduct } from './marketplace-scraper';
import { getShopifyAccessToken } from './shopify';
import { getScrapingAntApiKey, getScrapingAntUsage } from './scrapingant';

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
const MAX_BROWSER_FALLBACKS_PER_RUN = 2;
const MAX_SIMPLE_SCRAPES_PER_RUN = 50;
const MAX_IMPORT_RUNTIME_MS = 240000;

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function parseLocs(xml: string) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m => m[1].trim()).filter(Boolean);
}

async function scrapingAnt(url: string, timeoutMs = 60000, browser = false) {
  const key = getScrapingAntApiKey();
  if (!key) throw new Error('Add SCRAPINGANT_API_KEY in Vercel before enabling Meesho Auto Import.');

  let lastError = 'ScrapingAnt request failed.';
  for (let attempt = 1; attempt <= 5; attempt++) {
    const endpoint = new URL('https://api.scrapingant.com/v2/general');
    endpoint.searchParams.set('url', url);
    endpoint.searchParams.set('browser', browser ? 'true' : 'false');
    endpoint.searchParams.set('proxy_country', 'in');
    endpoint.searchParams.set('timeout', String(Math.ceil(timeoutMs / 1000)));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint.toString(), {
        headers: { 'x-api-key': key, Accept: 'text/html,application/xml' },
        cache: 'no-store',
        signal: controller.signal,
      });
      const body = await response.text();
      if (!response.ok) {
        let detail = '';
        try {
          const parsed = JSON.parse(body);
          const rawDetail = typeof parsed?.detail === 'string'
            ? parsed.detail
            : typeof parsed?.message === 'string'
              ? parsed.message
              : '';
          detail = rawDetail ? ': ' + rawDetail.slice(0, 300) : '';
        } catch {}

        lastError = 'ScrapingAnt returned HTTP ' + response.status + detail + '.';

        if (response.status === 409 && attempt < 5) {
          await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
          continue;
        }
        throw new Error(lastError);
      }
      if (!body.trim()) throw new Error('ScrapingAnt returned an empty response.');
      return body;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      if (attempt < 5 && !/HTTP 409/.test(lastError)) {
        await new Promise(resolve => setTimeout(resolve, 700 * attempt));
        continue;
      }
      throw new Error(lastError);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastError);
}

async function fetchPublic(url: string, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36',
        Accept: 'text/html,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Source returned HTTP ' + response.status + '.');
    const body = await response.text();
    if (!body.trim()) throw new Error('Source returned an empty response.');
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSitemapDocument(url: string) {
  // Public sitemap XML is normally available without a scraper. Prefer that
  // path so the importer does not spend credits on discovery.
  try {
    return await fetchPublic(url);
  } catch {
    return scrapingAnt(url, 30000, false);
  }
}

async function discoverSearchUrls(keyword: string, limit: number) {
  const q = clean(keyword);
  if (!q) return [];
  const searchUrl = 'https://www.meesho.com/search?q=' + encodeURIComponent(q);
  try {
    const html = await fetchSitemapDocument(searchUrl);
    const found = new Set<string>();
    const add = (value: string) => {
      try {
        const decoded = value.replace(/\\u002F/g, '/').replace(/&amp;/g, '&');
        const absolute = decoded.startsWith('http')
          ? decoded
          : new URL(decoded, 'https://www.meesho.com').toString();
        const parsed = new URL(absolute);
        if (parsed.hostname.replace(/^www\\./, '') !== 'meesho.com') return;
        if (/\\/p\\/[^/?#]+/i.test(parsed.pathname)) found.add(absolute);
      } catch {}
    };

    for (const match of html.matchAll(/(?:href|url|productUrl|product_url)\\s*[:=]\\s*["']([^"']+)["']/gi)) add(match[1]);
    for (const match of html.matchAll(/https?:\\/\\/(?:www\\.)?meesho\\.com\\/[^"'\\s<>]+\\/p\\/[^"'\\s<>?#]+/gi)) add(match[0]);

    return [...found].slice(0, Math.max(1, limit));
  } catch {
    return [];
  }
}

async function loadSitemapShards(settings: MeeshoAutoSettings) {
  const cached = Array.isArray(settings.sitemapShards) ? settings.sitemapShards.filter(Boolean) : [];
  const freshAt = settings.sitemapFetchedAt ? Date.parse(settings.sitemapFetchedAt) : 0;
  if (cached.length && Number.isFinite(freshAt) && Date.now() - freshAt < 24 * 60 * 60 * 1000) return cached;

  const xml = await fetchSitemapDocument(SITEMAP_INDEX);
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

  // Use Meesho's search result page first. This is one cheap discovery request
  // and gives us products relevant to the requested keyword before scraping
  // individual PDPs. Sitemap scanning is only the fallback.
  if (keyword) {
    urls.push(...await discoverSearchUrls(keyword, Math.max(maxItems * 3, 20)));
  }

  let shardOffset = 0;

  // Sitemap fallback: do not filter the URL slug by keyword. Meesho's sitemap
  // is not a reliable keyword index; keyword matching is performed after the
  // actual product page is scraped.
  for (
    ;
    shardOffset < Math.min(configuredShardCount, shards.length) && urls.length < maxItems * 4;
    shardOffset++
  ) {
    const shard = shards[(cursor + shardOffset) % shards.length];
    selected.push(shard);

    try {
      const shardDocument = await fetchSitemapDocument(shard);
      const shardUrls = parseLocs(shardDocument)
        .filter(url => /^https?:\/\/(?:www\.)?meesho\.com\/[^?#]+\/p\/[a-z0-9]+(?:[?#]|$)/i.test(url));

      urls.push(...shardUrls);
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
  let simpleScrapesUsed = 0;
  let browserFallbacksRemaining = MAX_BROWSER_FALLBACKS_PER_RUN;
  let creditUsage = await getScrapingAntUsage();

  // Keep a conservative reserve. A simple request costs 1 credit; browser
  // rendering costs 10. We never spend the whole reported balance in one run.
  const reportedRemaining = creditUsage.remainingCredits;
  if (reportedRemaining !== null && reportedRemaining < 12) {
    throw new Error(
      'ScrapingAnt has only ' + reportedRemaining + ' credits remaining. Import stopped to protect the remaining credits.',
    );
  }

  const startedAt = Date.now();

  for (const url of uniqueUrls) {
    if (products.length >= maxItems) break;
    if (Date.now() - startedAt >= MAX_IMPORT_RUNTIME_MS) {
      failureDetails.push('Import stopped safely before the runtime limit. Run it again to continue.');
      break;
    }
    if (simpleScrapesUsed >= MAX_SIMPLE_SCRAPES_PER_RUN) {
      failureDetails.push('Scraping budget reached. Run the import again to continue from the next sitemap shard.');
      break;
    }

    try {
      simpleScrapesUsed++;
      const allowBrowserFallback =
        browserFallbacksRemaining > 0
        && (creditUsage.remainingCredits === null || creditUsage.remainingCredits >= 12);

      const item = await scrapeMarketplaceProduct(url, {
        allowBrowserFallback,
        onBrowserFallback: () => { browserFallbacksRemaining--; },
      });

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
    scraping: {
      simpleRequestsAttempted: simpleScrapesUsed,
      browserFallbacksUsed: MAX_BROWSER_FALLBACKS_PER_RUN - browserFallbacksRemaining,
      remainingCreditsBeforeRun: reportedRemaining,
      remainingCreditsAfterRun: (await getScrapingAntUsage()).remainingCredits,
    },
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
