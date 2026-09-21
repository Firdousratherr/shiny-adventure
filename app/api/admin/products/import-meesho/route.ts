import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { put } from '@vercel/blob';
import { requireAdminPermission } from '../../../../../lib/admin-access';
import { db } from '../../../../../lib/db';
import { recordAdminAudit } from '../../../../../lib/admin-audit';

export const runtime = 'nodejs';

const MAX_HTML_BYTES = 4 * 1024 * 1024;
const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DIRECT_FETCH_TIMEOUT_MS = 12000;
const SCRAPER_FETCH_TIMEOUT_MS = 45000;

function cleanText(value: unknown, max = 10000) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function uniqueStrings(values: unknown[]) {
  return [...new Set(values.filter((v): v is string => typeof v === 'string' && /^https?:\/\//i.test(v)).map(v => v.trim()))];
}

function decodeHtml(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function meta(html: string, name: string) {
  const m = html.match(new RegExp("<meta[^>]+(?:property|name)=[\"']" + name + "[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>", 'i'));
  return m ? decodeHtml(m[1]) : '';
}

function parseJsonLd(html: string) {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const values: any[] = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1].trim());
      if (Array.isArray(parsed)) values.push(...parsed);
      else if (parsed?.['@graph'] && Array.isArray(parsed['@graph'])) values.push(...parsed['@graph']);
      else values.push(parsed);
    } catch {}
  }
  return values;
}

function extractNextData(html: string) {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function findFirstString(root: unknown, keys: string[], maxNodes = 5000) {
  const queue: unknown[] = [root];
  let visited = 0;
  while (queue.length && visited < maxNodes) {
    const node = queue.shift();
    visited++;
    if (!node || typeof node !== 'object') continue;
    for (const key of keys) {
      const value = (node as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) return value;
      if (typeof value === 'number') return String(value);
    }
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (value && typeof value === 'object') queue.push(value);
    }
  }
  return '';
}

function findStrings(root: unknown, keys: string[], maxNodes = 5000) {
  const out: string[] = [];
  const queue: unknown[] = [root];
  let visited = 0;
  while (queue.length && visited < maxNodes) {
    const node = queue.shift();
    visited++;
    if (!node || typeof node !== 'object') continue;
    for (const key of keys) {
      const value = (node as Record<string, unknown>)[key];
      if (typeof value === 'string') out.push(value);
      else if (Array.isArray(value)) out.push(...value.filter((v): v is string => typeof v === 'string'));
    }
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (value && typeof value === 'object') queue.push(value);
    }
  }
  return out;
}

function parseSourceId(url: string) {
  const m = url.match(/\/p\/([^/?#]+)/i);
  return m?.[1] || new URL(url).pathname.replace(/\//g, '_').slice(0, 100);
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || ('meesho-' + Date.now());
}

function decimalPrice(value: unknown) {
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function looksLikeMeeshoChallenge(html: string) {
  return /sec-if-cpt-container|akamai|access denied|request blocked/i.test(html) &&
    !html.includes('__NEXT_DATA__') &&
    !html.includes('application/ld+json');
}

function validateMeeshoHtml(html: string) {
  if (looksLikeMeeshoChallenge(html)) {
    throw new Error('Meesho anti-bot protection blocked this request.');
  }
  if (!html.includes('__NEXT_DATA__') && !html.includes('application/ld+json')) {
    throw new Error('Meesho returned a page without product data.');
  }
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
    throw new Error('Meesho product page is too large to import.');
  }
  return html;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDirect(url: string) {
  const response = await fetchWithTimeout(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      Referer: 'https://www.google.com/',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-User': '?1',
      Upgrade: '1',
    },
    cache: 'no-store',
  }, DIRECT_FETCH_TIMEOUT_MS);

  if (!response.ok) throw new Error('Meesho returned HTTP ' + response.status + '.');
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_HTML_BYTES) throw new Error('Meesho product page is too large to import.');
  return validateMeeshoHtml(await response.text());
}

async function fetchViaScrapingBee(url: string, apiKey: string) {
  const endpoint = new URL('https://app.scrapingbee.com/api/v1/');
  endpoint.searchParams.set('api_key', apiKey);
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('render_js', 'false');
  endpoint.searchParams.set('premium_proxy', 'true');
  const response = await fetchWithTimeout(endpoint.toString(), {
    headers: { Accept: 'text/html,application/xhtml+xml' },
    cache: 'no-store',
  }, SCRAPER_FETCH_TIMEOUT_MS);
  if (!response.ok) throw new Error('Meesho scraper returned HTTP ' + response.status + '.');
  return validateMeeshoHtml(await response.text());
}

async function fetchPage(url: string) {
  let directError: Error | null = null;
  try {
    return await fetchDirect(url);
  } catch (error) {
    directError = error instanceof Error ? error : new Error('Direct Meesho request failed.');
  }

  const scraperKey = process.env.SCRAPINGBEE_API_KEY?.trim();
  if (scraperKey) {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await fetchViaScrapingBee(url, scraperKey);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Meesho scraper request failed.');
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 900));
      }
    }
    throw new Error(lastError?.message || directError?.message || 'Unable to read Meesho product.');
  }

  const message = directError?.message || 'Unable to read Meesho product.';
  if (/HTTP 403|anti-bot|blocked/i.test(message)) {
    throw new Error("Meesho blocked Zenvora's server request (HTTP 403). Add SCRAPINGBEE_API_KEY in Vercel to enable the automatic anti-bot fallback, then retry.");
  }
  throw new Error(message);
}

async function parseMeesho(url: string) {
  const parsedUrl = new URL(url);
  if (!['www.meesho.com', 'meesho.com'].includes(parsedUrl.hostname.toLowerCase())) {
    throw new Error('Only public Meesho product URLs are supported.');
  }
  if (!/\/p\//i.test(parsedUrl.pathname)) throw new Error('Please paste a Meesho product URL containing /p/.');

  const html = await fetchPage(parsedUrl.toString());
  const jsonLd = parseJsonLd(html);
  const nextData = extractNextData(html);
  const productJson = jsonLd.find(x => x?.['@type'] === 'Product' || (Array.isArray(x?.['@type']) && x['@type'].includes('Product'))) || {};
  const offer = Array.isArray(productJson?.offers) ? productJson.offers[0] : productJson?.offers;

  const name = cleanText(productJson?.name, 200) || cleanText(meta(html, 'og:title'), 200) || cleanText(findFirstString(nextData, ['productName', 'name', 'title']), 200);
  const description = cleanText(productJson?.description) || cleanText(meta(html, 'og:description')) || cleanText(findFirstString(nextData, ['description', 'productDescription']));
  const sourceCost = decimalPrice(offer?.price) || decimalPrice(meta(html, 'product:price:amount')) || decimalPrice(findFirstString(nextData, ['price', 'sellingPrice', 'mrp']));
  const category = cleanText(productJson?.category, 100) || cleanText(findFirstString(nextData, ['categoryName', 'category']), 100);
  const images = uniqueStrings([
    ...(Array.isArray(productJson?.image) ? productJson.image : [productJson?.image]),
    meta(html, 'og:image'),
    ...findStrings(nextData, ['image', 'imageUrl', 'imageURL'], 4000),
  ]).slice(0, MAX_IMAGES);

  if (!name) throw new Error('Could not read the product name from this Meesho page. Try another public product URL.');
  if (!sourceCost) throw new Error('Could not read the product price from this Meesho page.');
  if (!images.length) throw new Error('Could not read product images from this Meesho page.');

  return { sourceUrl: parsedUrl.toString(), externalId: parseSourceId(parsedUrl.toString()), name, description, sourceCost, category, images };
}

async function importImage(productId: string, imageUrl: string, index: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZenvoraProductImporter/1.0)', Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    const extension = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : type === 'image/jpeg' ? 'jpg' : null;
    if (!extension) return null;
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_IMAGE_BYTES) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) return null;
    const blob = await put('products/' + productId + '/meesho-' + index + '-' + crypto.randomUUID() + '.' + extension, new Blob([buffer], { type }), { access: 'public', addRandomSuffix: false });
    return blob.url;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getOrCreateIntegration() {
  return db.marketplaceIntegration.upsert({
    where: { provider: 'MEESHO_URL_IMPORT' },
    update: { enabled: true },
    create: { provider: 'MEESHO_URL_IMPORT', enabled: true, autoSync: false, healthStatus: 'MANUAL_IMPORT' },
  });
}

export async function POST(request: Request) {
  const admin = await requireAdminPermission('products');
  if (!admin) return NextResponse.json({ error: 'Products permission required.' }, { status: 403 });
  const marketplace = await requireAdminPermission('marketplaces');
  if (!marketplace) return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });

  try {
    const body = await request.json();
    const action = body.action === 'import' ? 'import' : 'preview';
    const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
    const markupPercent = Number(body.markupPercent ?? 30);
    if (!sourceUrl) return NextResponse.json({ error: 'Meesho product URL is required.' }, { status: 400 });
    if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 500) return NextResponse.json({ error: 'Markup must be between 0% and 500%.' }, { status: 400 });

    const parsed = await parseMeesho(sourceUrl);
    const sellingPrice = Math.round(parsed.sourceCost * (1 + markupPercent / 100) * 100) / 100;

    if (action === 'preview') return NextResponse.json({ product: { ...parsed, sellingPrice, markupPercent } });

    const pricing = await requireAdminPermission('pricing');
    if (!pricing) return NextResponse.json({ error: 'Pricing permission required to import products.' }, { status: 403 });

    const integration = await getOrCreateIntegration();
    const existing = await db.marketplaceProduct.findUnique({
      where: { integrationId_externalId: { integrationId: integration.id, externalId: parsed.externalId } },
      select: { productId: true },
    });
    if (existing?.productId) return NextResponse.json({ error: 'This Meesho product has already been imported.', productId: existing.productId }, { status: 409 });

    const baseSlug = slugify(parsed.name);
    let slug = baseSlug;
    let suffix = 2;
    while (await db.product.findUnique({ where: { slug }, select: { id: true } })) slug = baseSlug + '-' + suffix++;

    const categoryRecord = parsed.category
      ? await db.category.findFirst({ where: { name: { equals: parsed.category, mode: 'insensitive' } }, select: { id: true } })
      : null;

    const product = await db.product.create({
      data: {
        name: parsed.name,
        slug,
        description: parsed.description || null,
        sourceUrl: parsed.sourceUrl,
        sourceCost: new Prisma.Decimal(parsed.sourceCost),
        sellingPrice: new Prisma.Decimal(sellingPrice),
        stock: 0,
        categoryId: categoryRecord?.id || null,
        status: 'DRAFT',
      },
    });

    let importedImages = 0;
    for (let i = 0; i < parsed.images.length; i++) {
      const imageUrl = await importImage(product.id, parsed.images[i], i);
      if (!imageUrl) continue;
      await db.productImage.create({ data: { productId: product.id, url: imageUrl, altText: parsed.name, sortOrder: importedImages } });
      importedImages++;
    }

    await db.marketplaceProduct.create({
      data: {
        integrationId: integration.id,
        externalId: parsed.externalId,
        productId: product.id,
        title: parsed.name,
        sourceUrl: parsed.sourceUrl,
        rawData: { category: parsed.category, sourceCost: parsed.sourceCost, markupPercent, imageCount: importedImages },
      },
    });

    await db.marketplaceIntegration.update({
      where: { id: integration.id },
      data: { importedProducts: { increment: 1 }, lastSyncAt: new Date(), lastSuccessAt: new Date(), healthStatus: 'HEALTHY' },
    });

    await recordAdminAudit({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'MEESHO_PRODUCT_IMPORTED',
      entityType: 'PRODUCT',
      entityId: product.id,
      details: { sourceUrl: parsed.sourceUrl, sourceCost: parsed.sourceCost, sellingPrice, markupPercent, importedImages },
    });

    return NextResponse.json({ ok: true, productId: product.id, importedImages, sellingPrice, markupPercent });
  } catch (error) {
    console.error('Meesho product import failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to import Meesho product.' }, { status: 500 });
  }
}
