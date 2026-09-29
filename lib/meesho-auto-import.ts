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
  directUrl?: string;
  defaultInventory?: number;
};

const SITEMAP_INDEX = 'https://www.meesho.com/sitemap.xml';
const DEFAULT_SHARD_COUNT = 1;
const DEFAULT_MAX_ITEMS = 10;
const MAX_BROWSER_FALLBACKS_PER_RUN = 8;
const MAX_SIMPLE_SCRAPES_PER_RUN = 12;
const MAX_PRODUCTS_PER_RUN = 8;
const MAX_IMPORT_RUNTIME_MS = 210000;

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function parseLocs(xml: string) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m => m[1].trim()).filter(Boolean);
}

async function scrapingAnt(
  url: string,
  timeoutMs = 30000,
  browser = false,
  waitForSelector?: string,
) {
  const key = getScrapingAntApiKey();
  if (!key) throw new Error('Add SCRAPINGANT_API_KEY in Vercel before enabling Meesho Auto Import.');

  let lastError = 'ScrapingAnt request failed.';
  const attempts = 2;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const endpoint = new URL('https://api.scrapingant.com/v2/general');
    endpoint.searchParams.set('url', url);
    endpoint.searchParams.set('browser', browser ? 'true' : 'false');
    endpoint.searchParams.set('proxy_country', 'in');
    endpoint.searchParams.set('timeout', String(Math.max(5, Math.min(60, Math.ceil(timeoutMs / 1000)))));
    if (browser && waitForSelector) endpoint.searchParams.set('wait_for_selector', waitForSelector);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint.toString(), {
        headers: { 'x-api-key': key, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
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
        } catch {
          // Ignore a non-JSON error body.
        }
        lastError = 'ScrapingAnt returned HTTP ' + response.status + detail + '.';

        if (attempt < attempts && [409, 423, 429, 500, 502, 503, 504].includes(response.status)) {
          await new Promise(resolve => setTimeout(resolve, 1200 * attempt));
          continue;
        }
        throw new Error(lastError);
      }

      if (!body.trim()) throw new Error('ScrapingAnt returned an empty response.');
      return body;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      if (attempt < attempts && /timed out|aborted|HTTP (409|423|429|5\d\d)/i.test(lastError)) {
        await new Promise(resolve => setTimeout(resolve, 900 * attempt));
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

function normalizeMeeshoUrl(value: string) {
  try {
    const decoded = value
      .replace(/&amp;/g, '&')
      .replace(/\\u002F/gi, '/')
      .replace(/\\\//g, '/')
      .replace(/^["']|["']$/g, '')
      .trim();
    const absolute = decoded.startsWith('http')
      ? decoded
      : decoded.startsWith('//')
        ? 'https:' + decoded
        : new URL(decoded, 'https://www.meesho.com').toString();
    const parsed = new URL(absolute);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'meesho.com') return '';
    if (!/\/p\/[^/?#]+|\/s\/p\/[^/?#]+/i.test(parsed.pathname)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function extractMeeshoProductUrls(source: string, limit = 20) {
  const html = source
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');

  const found = new Set<string>();
  const add = (value: string) => {
    const normalized = normalizeMeeshoUrl(value);
    if (normalized) found.add(normalized);
  };

  const absolutePattern = /https?:\/\/(?:www\.)?meesho\.com\/[^"'<>]+?\/(?:p|s\/p)\/[^"'<>?#]+/gi;
  const relativePattern = /["'](\/[^"'<>]+?\/(?:p|s\/p)\/[^"'<>?#]+)["']/gi;
  const propertyPattern = /(?:href|url|productUrl|product_url)\s*[:=]\s*["']([^"']+)["']/gi;

  for (const match of html.matchAll(absolutePattern)) add(match[0]);
  for (const match of html.matchAll(relativePattern)) add(match[1]);
  for (const match of html.matchAll(propertyPattern)) add(match[1]);

  return [...found].slice(0, Math.max(1, Math.min(100, limit)));
}

async function discoverSearchUrls(keyword: string, limit: number) {
  const q = clean(keyword);
  if (!q) return [];

  const searchUrl = 'https://www.meesho.com/search?q=' + encodeURIComponent(q);

  try {
    const direct = await fetchPublic(searchUrl);
    const directUrls = extractMeeshoProductUrls(direct, limit);
    if (directUrls.length) return directUrls;
  } catch {
    // Continue to rendered discovery.
  }

  // Meesho is a SPA. The rendered HTML can contain very few anchors while the
  // actual catalogue arrives through fetch/XHR calls. ScrapingAnt's extended
  // browser response exposes those network responses, so scan both page HTML
  // and XHR bodies for product URLs before falling back to the sitemap.
  try {
    const key = getScrapingAntApiKey();
    if (!key) return [];

    const endpoint = new URL('https://api.scrapingant.com/v2/extended');
    endpoint.searchParams.set('url', searchUrl);
    endpoint.searchParams.set('browser', 'true');
    endpoint.searchParams.set('proxy_country', 'in');
    endpoint.searchParams.set('timeout', '35');
    endpoint.searchParams.set('wait_for_selector', 'a[href*="/p/"]');

    const response = await fetch(endpoint.toString(), {
      headers: { 'x-api-key': key, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return [];

    const data: any = await response.json();
    const sources: string[] = [];
    if (typeof data?.html === 'string') sources.push(data.html);
    if (typeof data?.content === 'string') sources.push(data.content);
    if (Array.isArray(data?.xhrs)) {
      for (const xhr of data.xhrs) {
        if (typeof xhr?.body === 'string') sources.push(xhr.body);
        if (typeof xhr?.url === 'string') sources.push(xhr.url);
      }
    }

    const found = new Set<string>();
    for (const source of sources) {
      for (const url of extractMeeshoProductUrls(source, limit)) {
        found.add(url);
        if (found.size >= limit) return [...found].slice(0, limit);
      }
    }
    return [...found].slice(0, limit);
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
  const maxItems = Math.max(1, Math.min(MAX_PRODUCTS_PER_RUN, Number(settings.maxItemsPerSync ?? DEFAULT_MAX_ITEMS)));
  const keyword = clean(settings.keywords);
  const directUrl = clean(settings.directUrl);
  const urls: string[] = [];
  const selected: string[] = [];
  let shards: string[] = [];
  let discoveryMethod: 'DIRECT_URL' | 'SEARCH' | 'SEARCH_PLUS_SITEMAP' | 'SITEMAP_FALLBACK' = directUrl ? 'DIRECT_URL' : 'SEARCH';
  let discoveryError = '';

  if (directUrl) {
    const normalized = normalizeMeeshoUrl(directUrl);
    if (!normalized) throw new Error('Enter a valid Meesho product URL containing /p/ or /s/p/.');
    urls.push(normalized);
  } else if (keyword) {
    urls.push(...await discoverSearchUrls(keyword, Math.max(maxItems * 2, 12)));
  }

  // Sitemap is a true fallback, not the primary keyword index. We only touch it
  // when rendered search discovery did not produce enough product URLs.
  if (!directUrl && urls.length < maxItems) {
    try {
      shards = await loadSitemapShards(settings);
      const cursor = Math.max(0, Number(settings.shardCursor ?? 0)) % shards.length;
      const configuredShardCount = Math.max(1, Math.min(3, Number(settings.shardCountPerRun ?? DEFAULT_SHARD_COUNT)));

      for (
        let shardOffset = 0;
        shardOffset < Math.min(configuredShardCount, shards.length) && urls.length < maxItems * 2;
        shardOffset++
      ) {
        const shard = shards[(cursor + shardOffset) % shards.length];
        selected.push(shard);
        try {
          const shardDocument = await fetchSitemapDocument(shard);
          const shardUrls = parseLocs(shardDocument)
            .filter(url => /^https?:\/\/(?:www\.)?meesho\.com\/[^?#]+\/(?:p|s\/p)\/[^/?#]+/i.test(url));
          urls.push(...shardUrls);
        } catch {
          // One unavailable shard should not abort the run.
        }
      }

      discoveryMethod = urls.length
        ? (keyword ? 'SEARCH_PLUS_SITEMAP' : 'SITEMAP_FALLBACK')
        : 'SITEMAP_FALLBACK';
    } catch (error) {
      discoveryError = error instanceof Error ? error.message : 'Meesho sitemap discovery failed.';
      if (!urls.length && !keyword) throw new Error(discoveryError);
    }
  }

  const uniqueUrls = [...new Set(urls)].slice(0, Math.min(30, Math.max(maxItems * 2, maxItems)));
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
  if (discoveryError) failureDetails.push(discoveryError);

  let browserRequestsUsed = 0;
  let simpleRequestsAttempted = 0;
  let browserFallbacksRemaining = directUrl || keyword ? MAX_BROWSER_FALLBACKS_PER_RUN : 0;
  const reportedRemaining = (await getScrapingAntUsage()).remainingCredits;

  // Keep a reserve so a single run cannot unexpectedly consume the account.
  if (reportedRemaining !== null && reportedRemaining < 10) {
    throw new Error(
      'ScrapingAnt has only ' + reportedRemaining + ' credits remaining. At least 10 credits are required for reliable Meesho browser import.',
    );
  }

  // IMPORTANT: keep this loop sequential. ScrapingAnt can return HTTP 409 for
  // concurrent requests on some plans, so parallel product scraping is unsafe.
  const startedAt = Date.now();

  for (const url of uniqueUrls) {
    if (products.length >= maxItems) break;
    if (Date.now() - startedAt >= MAX_IMPORT_RUNTIME_MS) {
      failureDetails.push('Import stopped safely before the server runtime limit. Run it again to continue.');
      break;
    }

    try {
      simpleRequestsAttempted++;
      const allowBrowserFallback =
        browserFallbacksRemaining > 0
        && (reportedRemaining === null || reportedRemaining >= 10);

      const item = await scrapeMarketplaceProduct(url, {
        allowBrowserFallback,
        preferBrowser: true,
        onBrowserFallback: () => {
          browserFallbacksRemaining--;
          browserRequestsUsed++;
        },
      });

      if (item.provider !== 'MEESHO') continue;
      if (!matchesFilters(item, settings) && !directUrl) continue;

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
      if (failureDetails.length < 5) {
        failureDetails.push(error instanceof Error ? error.message.slice(0, 1000) : 'Product scrape failed.');
      }
    }
  }

  if (!products.length) {
    if (failureDetails.length === 0) {
      failureDetails.push(
        directUrl
          ? 'The Meesho product page did not expose a usable title, price and product image.'
          : keyword
            ? 'Meesho search did not expose usable product links for this keyword. Try another keyword or paste a direct product URL.'
            : 'No Meesho product URLs were discovered.',
      );
    }
  }

  const shardCursor = shards.length
    ? (Math.max(0, Number(settings.shardCursor ?? 0)) + Math.max(1, selected.length)) % shards.length
    : Math.max(0, Number(settings.shardCursor ?? 0));

  return {
    products,
    shardCursor,
    sitemapShards: shards.length ? shards : (Array.isArray(settings.sitemapShards) ? settings.sitemapShards : []),
    sitemapFetchedAt: shards.length ? new Date().toISOString() : settings.sitemapFetchedAt ?? null,
    shardsScanned: selected.length,
    urlsScanned: uniqueUrls.length,
    discoveryMethod,
    failed,
    failureDetails,
    scraping: {
      simpleRequestsAttempted,
      browserFallbacksUsed: browserRequestsUsed,
      discoveryBrowserRequestUsed: discoveryMethod !== 'DIRECT_URL' && Boolean(keyword),
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
