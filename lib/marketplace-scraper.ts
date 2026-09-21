import { URL } from 'url';

export type ScrapedMarketplaceProduct = {
  provider: 'AMAZON' | 'FLIPKART' | 'MEESHO';
  externalId: string;
  sourceUrl: string;
  name: string;
  description: string;
  sourceCost: number;
  images: string[];
};

const MAX_HTML_BYTES = 6 * 1024 * 1024;
const MAX_IMAGES = 8;
const DIRECT_TIMEOUT_MS = 10000;
const SCRAPER_TIMEOUT_MS = 50000;

function cleanText(value: unknown, max = 10000) {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, max);
}

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function meta(html: string, key: string) {
  const re = new RegExp('<meta[^>]+(?:property|name)=["\\\']' + key.replace(/[.*+?^{}()|[\\]\\\\]/g, '\\\\$&') + '["\\\'][^>]+content=["\\\']([^"\\\']+)["\\\'][^>]*>', 'i');
  const m = html.match(re);
  return m ? decodeHtml(m[1]) : '';
}

function parseJsonLd(html: string): any[] {
  const out: any[] = [];
  for (const block of html.matchAll(/<script[^>]*type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi)) {
    try {
      const parsed = JSON.parse(block[1].trim());
      const values = Array.isArray(parsed) ? parsed : parsed?.['@graph'] && Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];
      for (const value of values) if (value && typeof value === 'object') out.push(value);
    } catch {}
  }
  return out;
}

function extractNextData(html: string) {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\\s\\S]*?)<\\/script>/i);
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
    const match = text.match(/(?:₹|Rs\\.?|INR)?\\s*([0-9]+(?:\\.[0-9]{1,2})?)/i);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > 0 && n < 100000000) return n;
  }
  return null;
}

function uniqueImages(values: unknown[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const url = decodeHtml(value).trim().replace(/\\\\u002F/g, '/');
    if (!/^https?:\\/\\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_IMAGES) break;
  }
  return out;
}

function providerFromUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  const host = url.hostname.toLowerCase().replace(/^www\\./, '');
  if (host === 'amazon.in' || host === 'amazon.com' || host === 'amazon.co.uk') {
    const match = url.pathname.match(/\\/(?:dp|gp\\/product|product)\\/([A-Z0-9]{10})(?:[\\/?]|$)/i);
    if (!match) throw new Error('Use a direct Amazon product URL containing its ASIN.');
    return { provider: 'AMAZON' as const, id: match[1].toUpperCase(), url: url.toString() };
  }
  if (host === 'flipkart.com') {
    const pid = url.searchParams.get('pid');
    if (!pid) throw new Error('Use a direct Flipkart product URL containing its pid.');
    return { provider: 'FLIPKART' as const, id: pid, url: url.toString() };
  }
  if (host === 'meesho.com') {
    if (!/\\/p\\//i.test(url.pathname)) throw new Error('Use a direct Meesho product URL containing /p/.');
    const id = url.pathname.match(/\\/p\\/([^/?#]+)/i)?.[1] || url.pathname;
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

async function scraperFetch(url: string, provider: string) {
  const apiKey = process.env.SCRAPINGBEE_API_KEY?.trim();
  if (!apiKey) throw new Error('Automatic scraping is not configured. Add SCRAPINGBEE_API_KEY in Vercel, or enter title and price manually.');
  const endpoint = new URL('https://app.scrapingbee.com/api/v1/');
  endpoint.searchParams.set('api_key', apiKey);
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('mode', 'auto');
  endpoint.searchParams.set('max_cost', process.env.SCRAPINGBEE_MAX_COST?.trim() || '75');
  endpoint.searchParams.set('country_code', 'in');
  endpoint.searchParams.set('wait_browser', 'load');
  if (provider === 'AMAZON' || provider === 'FLIPKART' || provider === 'MEESHO') endpoint.searchParams.set('wait', '1500');

  const response = await fetchWithTimeout(endpoint.toString(), {
    headers: { Accept: 'text/html,application/xhtml+xml' },
    cache: 'no-store',
  }, SCRAPER_TIMEOUT_MS);
  const body = await response.text();
  if (!response.ok) throw new Error('Automatic scraper returned HTTP ' + response.status + (body ? ': ' + body.slice(0, 220) : '.'));
  if (Buffer.byteLength(body, 'utf8') > MAX_HTML_BYTES) throw new Error('Scraped page is too large.');
  return body;
}

function parseProduct(provider: 'AMAZON' | 'FLIPKART' | 'MEESHO', url: string, html: string, id: string): ScrapedMarketplaceProduct {
  const jsonLd = parseJsonLd(html);
  const product = jsonLd.find(x => x?.['@type'] === 'Product' || (Array.isArray(x?.['@type']) && x['@type'].includes('Product'))) || {};
  const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  const nextData = extractNextData(html);

  const name = cleanText(product.name, 220) ||
    cleanText(meta(html, 'og:title'), 220) ||
    cleanText(meta(html, 'twitter:title'), 220) ||
    cleanText(walkStrings(nextData, ['productName', 'productTitle', 'title', 'name'], 3000)[0], 220);

  const description = cleanText(product.description, 12000) ||
    cleanText(meta(html, 'og:description'), 12000) ||
    cleanText(meta(html, 'description'), 12000) ||
    cleanText(walkStrings(nextData, ['description', 'productDescription'], 3000)[0], 12000);

  const priceCandidates = [
    offers?.price,
    offers?.lowPrice,
    meta(html, 'product:price:amount'),
    meta(html, 'og:price:amount'),
    ...walkStrings(nextData, ['sellingPrice', 'salePrice', 'price', 'amount'], 5000),
  ];
  if (provider === 'AMAZON') {
    const whole = html.match(/class=["'][^"']*a-price-whole[^"']*["'][^>]*>([0-9,]+)/i)?.[1];
    const fraction = html.match(/class=["'][^"']*a-price-fraction[^"']*["'][^>]*>([0-9]{1,2})/i)?.[1];
    if (whole) priceCandidates.unshift(whole + '.' + (fraction || '00'));
    const amazonPrice = html.match(/(?:priceToPay|displayPrice|priceblock_ourprice|priceblock_dealprice)[^]{0,800}?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)/i)?.[1];
    if (amazonPrice) priceCandidates.push(amazonPrice);
  }
  const sourceCost = firstNumber(priceCandidates) ?? 0;

  const images = uniqueImages([
    ...(Array.isArray(product.image) ? product.image : [product.image]),
    meta(html, 'og:image'),
    meta(html, 'twitter:image'),
    ...walkStrings(nextData, ['image', 'imageUrl', 'imageURL', 'imageSrc'], 6000),
  ]);

  if (!name) throw new Error('Could not read the product title from this page. Try a direct product URL.');
  if (!sourceCost) throw new Error('Could not read the current product price. Enter the price manually and preview again.');
  if (!images.length) throw new Error('Could not read a product image. You can continue by adding permitted image URLs manually.');

  return { provider, externalId: id, sourceUrl: url, name, description, sourceCost, images };
}

export async function scrapeMarketplaceProduct(sourceUrl: string) {
  const parsed = providerFromUrl(sourceUrl);
  let html: string | null = null;
  let directError = '';
  try { html = await directFetch(parsed.url); } catch (error) { directError = error instanceof Error ? error.message : 'Direct request failed.'; }

  if (html) {
    try { return parseProduct(parsed.provider, parsed.url, html, parsed.id); }
    catch (error) { directError = error instanceof Error ? error.message : directError; }
  }

  try {
    html = await scraperFetch(parsed.url, parsed.provider);
    return parseProduct(parsed.provider, parsed.url, html, parsed.id);
  } catch (error) {
    const scraperError = error instanceof Error ? error.message : 'Automatic scraper failed.';
    throw new Error(scraperError || directError || 'Unable to read product page.');
  }
}

export function parseMarketplaceSourceUrl(sourceUrl: string) {
  const parsed = providerFromUrl(sourceUrl);
  return { provider: parsed.provider, id: parsed.id, url: parsed.url };
}
