import { URL } from 'url';
import { getScrapingAntApiKey } from './scrapingant';

export type ScrapedMarketplaceProduct = {
  provider: 'AMAZON' | 'FLIPKART' | 'MEESHO';
  externalId: string;
  sourceUrl: string;
  name: string;
  description: string;
  sourceCost: number;
  images: string[];
  categoryName?: string;
  availability: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';
};

const MAX_HTML_BYTES = 6 * 1024 * 1024;
const MAX_IMAGES = 8;
const DIRECT_TIMEOUT_MS = 8000;
// Keep each scraper attempt short enough that a multi-product import cannot
// consume Vercel's 300s function limit.
const SCRAPER_SIMPLE_TIMEOUT_MS = 15000;
const SCRAPER_BROWSER_TIMEOUT_MS = 30000;

function cleanText(value: unknown, max = 10000) {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function decodeHtml(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function meta(html: string, key: string) {
  const escaped = key.replace(/[.*+?^()|]/g, '\\$&');
  const re = new RegExp('<meta[^>]+(?:property|name)=["\']' + escaped + '["\'][^>]+content=["\']([^"\']+)["\'][^>]*>', 'i');
  const m = html.match(re);
  return m ? decodeHtml(m[1]) : '';
}

function parseJsonLd(html: string): any[] {
  const out: any[] = [];
  for (const block of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(block[1].trim());
      const values = Array.isArray(parsed)
        ? parsed
        : parsed?.['@graph'] && Array.isArray(parsed['@graph'])
          ? parsed['@graph']
          : [parsed];
      for (const value of values) if (value && typeof value === 'object') out.push(value);
    } catch {}
  }
  return out;
}

function extractNextData(html: string) {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function walkStrings(root: unknown, keys: string[], maxNodes = 8000): string[] {
  const out: string[] = [];
  const queue: unknown[] = [root];
  let visited = 0;
  while (queue.length && visited++ < maxNodes) {
    const node = queue.shift();
    if (!node || typeof node !== 'object') continue;
    const record = node as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) out.push(value);
      else if (Array.isArray(value)) out.push(...value.filter((x): x is string => typeof x === 'string'));
    }
    for (const value of Object.values(record)) if (value && typeof value === 'object') queue.push(value);
  }
  return out;
}

function firstNumber(values: unknown[]): number | null {
  for (const value of values) {
    const text = String(value ?? '').replace(/,/g, '');
    const match = text.match(/(?:₹|Rs\.?|INR)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > 0 && n < 100000000) return n;
  }
  return null;
}

function normalizeCategoryName(value: unknown) {
  if (typeof value !== 'string') return '';
  const text = cleanText(value, 120)
    .replace(/\s*(?:›|»|→|->)\s*/g, ' > ')
    .replace(/\s*\/\s*/g, ' > ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || text.length < 2) return '';
  if (/^(home|homepage|shop|products?|catalogue|catalog|all categories?)$/i.test(text)) return '';
  return text.split(/\s*>\s*/).map(v => v.trim()).filter(Boolean).pop()?.slice(0, 80) || '';
}

function sourceCategory(provider: 'AMAZON' | 'FLIPKART' | 'MEESHO', html: string, jsonLd: any, nextData: any) {
  const structured = [
    jsonLd?.category,
    jsonLd?.categoryName,
    meta(html, 'product:category'),
    meta(html, 'category'),
    meta(html, 'og:category'),
    meta(html, 'twitter:category'),
    ...walkStrings(nextData, [
      'categoryName',
      'category_name',
      'subCategoryName',
      'subcategoryName',
      'sub_category_name',
      'categoryTitle',
      'category',
    ], 5000),
  ];

  for (const candidate of structured) {
    const value = normalizeCategoryName(candidate);
    if (value) return value;
  }

  const breadcrumbMatches = [
    ...html.matchAll(/<(?:nav|div|ol|ul)[^>]*(?:breadcrumb|wayfinding)[^>]*>([\s\S]*?)<\/(?:nav|div|ol|ul)>/gi),
  ];
  for (const match of breadcrumbMatches) {
    const parts = cleanText(match[1], 2000).split(/\s*(?:›|»|→|>|\/)\s*/).map(v => v.trim()).filter(Boolean);
    for (const candidate of [...parts].reverse()) {
      const value = normalizeCategoryName(candidate);
      if (value) return value;
    }
  }

  return '';
}

function uniqueImages(values: unknown[], provider?: 'AMAZON' | 'FLIPKART' | 'MEESHO') {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (typeof value !== 'string') continue;

    let url = decodeHtml(value).trim().replace(/\\u002F/g, '/').replace(/\\\//g, '/');
    if (url.startsWith('//')) url = 'https:' + url;
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;

    // Meesho pages contain many non-product images (discount, payment,
    // returns, delivery and other UI/benefit icons). Only accept images
    // from Meesho's product-image path when importing a Meesho product.
    if (provider === 'MEESHO') {
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (!host.endsWith('meesho.com') || !/\/images\//i.test(parsed.pathname) || /placeholder|no[-_ ]?image|default[-_ ]?image/i.test(parsed.pathname)) {
          continue;
        }
      } catch {
        continue;
      }
    }

    seen.add(url);
    out.push(url);
    if (out.length >= MAX_IMAGES) break;
  }

  return out;
}

function providerFromUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  if (host === 'amazon.in' || host === 'amazon.com' || host === 'amazon.co.uk') {
    const match = url.pathname.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})(?:[\/?]|$)/i);
    if (!match) throw new Error('Use a direct Amazon product URL containing its ASIN.');
    return { provider: 'AMAZON' as const, id: match[1].toUpperCase(), url: url.toString() };
  }

  if (host === 'flipkart.com') {
    const pid = url.searchParams.get('pid');
    if (!pid) throw new Error('Use a direct Flipkart product URL containing its pid.');
    return { provider: 'FLIPKART' as const, id: pid, url: url.toString() };
  }

  if (host === 'meesho.com') {
    const directPath = url.pathname.match(/\/p\/([^/?#]+)/i)?.[1];
    const sharedPath = url.pathname.match(/\/s\/p\/([^/?#]+)/i)?.[1];
    const id = directPath || sharedPath;
    if (!id) throw new Error('Use a direct Meesho product URL containing /p/ or /s/p/.');
    return { provider: 'MEESHO' as const, id, url: url.toString() };
  }

  throw new Error('Only Amazon, Flipkart and Meesho product URLs are supported.');
}

async function fetchWithTimeout(url: string, init: RequestInit, timeout: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function directFetch(url: string) {
  const response = await fetchWithTimeout(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  }, DIRECT_TIMEOUT_MS);

  if (!response.ok) throw new Error('Source returned HTTP ' + response.status + '.');
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_HTML_BYTES) throw new Error('Source page is too large.');
  const html = await response.text();
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) throw new Error('Source page is too large.');
  return html;
}

type ScraperFetchOptions = {
  browser: boolean;
  maxAttempts?: number;
  waitForSelector?: string;
};

async function scraperFetch(url: string, provider: string, options: ScraperFetchOptions) {
  const apiKey = getScrapingAntApiKey();
  if (!apiKey) throw new Error('Automatic scraping is not configured. Add SCRAPINGANT_API_KEY in Vercel, or enter title and price manually.');

  const maxAttempts = Math.max(1, Math.min(6, options.maxAttempts ?? 6));
  let lastError = 'Automatic scraper failed.';

  // ScrapingAnt documents HTTP 403 as a retryable detection response in its
  // migration guidance. Adapt browser mode and proxy settings instead of
  // repeatedly sending the same request fingerprint.
  //
  // Keep cheap routes first: browser+datacenter (10 credits), simple+datacenter
  // (1), browser raw-page-source+datacenter (2), then residential fallbacks.
  const routes = [
    { browser: options.browser, proxyType: 'datacenter', country: 'in', rawPageSource: false },
    { browser: false, proxyType: 'datacenter', country: 'in', rawPageSource: false },
    { browser: true, proxyType: 'datacenter', country: 'in', rawPageSource: true },
    { browser: false, proxyType: 'residential', country: 'in', rawPageSource: false },
    { browser: true, proxyType: 'residential', country: 'in', rawPageSource: false },
    { browser: false, proxyType: 'residential', country: '', rawPageSource: false },
  ].slice(0, maxAttempts);

  for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
    const route = routes[routeIndex];
    const endpoint = new URL('https://api.scrapingant.com/v2/general');
    endpoint.searchParams.set('url', url);
    endpoint.searchParams.set('browser', route.browser ? 'true' : 'false');
    endpoint.searchParams.set('proxy_type', route.proxyType);
    if (route.country) endpoint.searchParams.set('proxy_country', route.country);
    if (route.rawPageSource) endpoint.searchParams.set('return_page_source', 'true');
    endpoint.searchParams.set(
      'timeout',
      String(route.browser ? Math.ceil(SCRAPER_BROWSER_TIMEOUT_MS / 1000) : 15),
    );
    if (options.waitForSelector && route.browser && !route.rawPageSource) {
      endpoint.searchParams.set('wait_for_selector', options.waitForSelector);
    }

    try {
      const response = await fetchWithTimeout(endpoint.toString(), {
        headers: {
          'x-api-key': apiKey,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        cache: 'no-store',
      }, route.browser ? SCRAPER_BROWSER_TIMEOUT_MS : SCRAPER_SIMPLE_TIMEOUT_MS);

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

        // 403 is explicitly handled as a detection response by ScrapingAnt's
        // migration guidance. Move to the next browser/proxy combination.
        if (response.status === 403 && routeIndex < routes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 250));
          continue;
        }

        if ([409, 423, 429, 500, 502, 503, 504].includes(response.status) && routeIndex < routes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 750));
          continue;
        }

        throw new Error(lastError);
      }

      if (!body.trim()) throw new Error('ScrapingAnt returned an empty page.');
      if (Buffer.byteLength(body, 'utf8') > MAX_HTML_BYTES) throw new Error('Scraped page is too large.');

      const challenged = /sec-if-cpt-container/i.test(body)
        || /cf-chl-|challenge-platform/i.test(body)
        || /verify you are human|captcha|access denied/i.test(body);

      if (challenged) {
        lastError = 'Meesho returned an anti-bot challenge.';
        if (routeIndex < routes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 250));
          continue;
        }
        throw new Error(lastError);
      }

      return body;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      if (routeIndex < routes.length - 1 && /ScrapingAnt returned HTTP (403|409|423|429|5\d\d)|anti-bot challenge|timed out|aborted/i.test(lastError)) {
        await new Promise(resolve => setTimeout(resolve, 750));
        continue;
      }
      throw new Error(lastError);
    }
  }

  throw new Error(lastError);
}
function extractTagText(html: string, tag: string) {
  const match = html.match(new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>', 'i'));
  return match ? cleanText(match[1], 12000) : '';
}

function extractRupeeValues(html: string) {
  return [...html.matchAll(/(?:₹|Rs\\.?|INR)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)/gi)].map(match => match[1]);
}

function extractImageAttributeValues(html: string) {
  const values: string[] = [];
  for (const match of html.matchAll(/<(?:img|source)\\b[^>]*(?:src|data-src|data-lazy-src|srcset)=["']([^"']+)["']/gi)) {
    for (const value of match[1].split(/\\s*,\\s*/)) values.push(value.replace(/\\s+\\d+(?:\\.\\d+)?x$/i, '').trim());
  }
  for (const match of html.matchAll(/<link\\b[^>]*rel=["'][^"']*image_src[^"']*["'][^>]*href=["']([^"']+)["']/gi)) values.push(match[1]);
  return values;
}

function parseProduct(provider: 'AMAZON' | 'FLIPKART' | 'MEESHO', url: string, html: string, id: string): ScrapedMarketplaceProduct {
  const jsonLd = parseJsonLd(html);
  const product = jsonLd.find(x => x?.['@type'] === 'Product' || (Array.isArray(x?.['@type']) && x['@type'].includes('Product'))) || {};
  const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  const nextData = extractNextData(html);
  const categoryName = sourceCategory(provider, html, product, nextData);

  const name = cleanText(product.name, 220)
    || extractTagText(html, 'h1').slice(0, 220)
    || cleanText(meta(html, 'og:title'), 220)
    || cleanText(meta(html, 'twitter:title'), 220)
    || extractTagText(html, 'title').slice(0, 220)
    || cleanText(walkStrings(nextData, ['productName', 'productTitle', 'title', 'name'], 3000)[0], 220);

  const description = cleanText(product.description, 12000)
    || cleanText(meta(html, 'og:description'), 12000)
    || cleanText(meta(html, 'description'), 12000)
    || cleanText(walkStrings(nextData, ['description', 'productDescription', 'shortDescription'], 3000)[0], 12000)
    || extractTagText(html, 'p').slice(0, 12000);

  const priceCandidates: unknown[] = [
    ...(provider === 'MEESHO' ? extractRupeeValues(html) : []),
    offers?.price,
    offers?.lowPrice,
    meta(html, 'product:price:amount'),
    meta(html, 'og:price:amount'),
    ...walkStrings(nextData, ['sellingPrice', 'salePrice', 'priceValue', 'currentPrice', 'price', 'amount'], 5000),
  ];

  if (provider === 'AMAZON') {
    const whole = html.match(/class=["'][^"']*a-price-whole[^"']*["'][^>]*>([0-9,]+)/i)?.[1];
    const fraction = html.match(/class=["'][^"']*a-price-fraction[^"']*["'][^>]*>([0-9]{1,2})/i)?.[1];
    if (whole) priceCandidates.unshift(whole + '.' + (fraction || '00'));
    const amazonPrice = html.match(/(?:priceToPay|displayPrice|priceblock_ourprice|priceblock_dealprice)[^]{0,800}?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i)?.[1];
    if (amazonPrice) priceCandidates.push(amazonPrice);
  }

  const sourceCost = firstNumber(priceCandidates) ?? 0;
  const nextDataImageKeys = provider === 'MEESHO'
    ? [
        'images',
        'imageUrls',
        'image_urls',
        'productImages',
        'product_images',
        'productImage',
        'product_image',
        'product_image_large_url',
        'product_image_thumb_url',
        'image',
        'imageUrl',
        'imageURL',
      ]
    : ['image', 'imageUrl', 'imageURL', 'imageSrc'];

  const images = uniqueImages([
    ...(Array.isArray(product.image) ? product.image : [product.image]),
    ...walkStrings(nextData, nextDataImageKeys, 7000),
    ...extractImageAttributeValues(html),
    meta(html, 'og:image'),
    meta(html, 'twitter:image'),
  ], provider);

  if (!name) throw new Error('Could not read the product title from this Meesho page. Try a direct product URL.');
  if (!sourceCost) throw new Error('Could not read the current product price from this Meesho page.');
  if (!images.length) throw new Error('Could not read a product image from this Meesho page.');

  const bodyText = cleanText(html).toLowerCase();
  const unavailable = /out of stock|currently unavailable|sold out|not available|temporarily unavailable/.test(bodyText);
  const available = !unavailable && /in stock|add to cart|buy now|available for purchase/.test(bodyText);
  const availability = unavailable ? 'UNAVAILABLE' : available ? 'AVAILABLE' : 'UNKNOWN';

  return {
    provider,
    externalId: id,
    sourceUrl: url,
    name,
    description,
    sourceCost,
    images,
    categoryName: categoryName || undefined,
    availability,
  };
}

export type ScrapeMarketplaceOptions = {
  /** Browser rendering is the reliable path for dynamic Meesho pages. */
  allowBrowserFallback?: boolean;
  /** Prefer browser rendering for providers whose catalogue is client-rendered. */
  preferBrowser?: boolean;
  onBrowserFallback?: () => void;
};

export async function scrapeMarketplaceProduct(sourceUrl: string, options: ScrapeMarketplaceOptions = {}) {
  const parsed = providerFromUrl(sourceUrl);
  let html: string | null = null;
  let lastError = '';
  let browserAttempted = false;

  // All marketplace URL imports now use ScrapingAnt first. This keeps Amazon,
  // Flipkart and Meesho on the same proxy/browser pipeline and makes the
  // importer resilient to bot protection and JavaScript-rendered product pages.
  const scraperAttempts = parsed.provider === 'MEESHO' ? 3 : 2;

  if (options.preferBrowser !== false && options.allowBrowserFallback) {
    browserAttempted = true;
    try {
      options.onBrowserFallback?.();
      html = await scraperFetch(parsed.url, parsed.provider, {
        browser: true,
        maxAttempts: scraperAttempts,
        waitForSelector: 'h1',
      });
      return parseProduct(parsed.provider, parsed.url, html, parsed.id);
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'ScrapingAnt browser request failed.';
    }
  }

  // ScrapingAnt non-browser mode is the cheaper second route and is useful
  // when the target page is static or the browser route is challenged.
  try {
    html = await scraperFetch(parsed.url, parsed.provider, {
      browser: false,
      maxAttempts: scraperAttempts,
    });
    return parseProduct(parsed.provider, parsed.url, html, parsed.id);
  } catch (error) {
    lastError = error instanceof Error ? error.message : lastError;
  }

  // Final fallback for resilience if ScrapingAnt cannot reach a particular
  // public URL. Successful direct requests cost no ScrapingAnt credits.
  try {
    html = await directFetch(parsed.url);
    return parseProduct(parsed.provider, parsed.url, html, parsed.id);
  } catch (error) {
    lastError = error instanceof Error ? error.message : lastError;
  }

  throw new Error(lastError || 'Unable to import product from the supplied URL.');
}

export function parseMarketplaceSourceUrl(sourceUrl: string) {
  const parsed = providerFromUrl(sourceUrl);
  return { provider: parsed.provider, id: parsed.id, url: parsed.url };
}
