import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { put } from '@vercel/blob';
import { getAdminAccess } from '@/lib/admin-access';
import { db } from '@/lib/db';
import { parseMarketplaceSourceUrl, scrapeMarketplaceProduct } from '@/lib/marketplace-scraper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'imported-product';
}

function sellingPrice(cost: number, markup: number) {
  return Math.round(cost * (1 + markup / 100) * 100) / 100;
}

function normalizeCategory(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

async function importImage(productId: string, imageUrl: string, index: number) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZenvoraProductImporter/1.0)', Accept: 'image/avif,image/webp,image/jpeg,image/png,*/*' },
        cache: 'no-store',
      });
      if (!response.ok) return null;
      const type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      const extension = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : type === 'image/jpeg' ? 'jpg' : null;
      if (!extension) return null;
      const buffer = await response.arrayBuffer();
      if (!buffer.byteLength || buffer.byteLength > 5 * 1024 * 1024) return null;
      const blob = await put(`products/${productId}/marketplace-${index}-${crypto.randomUUID()}.${extension}`, new Blob([buffer], { type }), { access: 'private', addRandomSuffix: false });
      return blob.url;
    } finally { clearTimeout(timer); }
  } catch { return null; }
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (!access || (!access.isSuperAdmin && (!access.permissions.includes('products') || !access.permissions.includes('marketplaces')))) {
    return NextResponse.json({ error: 'Marketplace import permission required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const action = body.action === 'import' ? 'import' : 'preview';
    const sourceUrl = String(body.sourceUrl || '').trim();
    const markup = Number(body.markupPercent ?? 30);
    if (!sourceUrl) return NextResponse.json({ error: 'Product URL is required.' }, { status: 400 });
    if (!Number.isFinite(markup) || markup < 0 || markup > 500) return NextResponse.json({ error: 'Markup must be between 0% and 500%.' }, { status: 400 });

    const parsedUrl = parseMarketplaceSourceUrl(sourceUrl);
    let scraped: Awaited<ReturnType<typeof scrapeMarketplaceProduct>> | null = null;
    let scrapeError = '';
    try { scraped = await scrapeMarketplaceProduct(parsedUrl.url); }
    catch (error) { scrapeError = error instanceof Error ? error.message : 'Automatic product reading failed.'; }

    const manualName = String(body.name || '').trim();
    const manualDescription = String(body.description || '').trim();
    const manualCost = Number(body.sourceCost);
    const manualImages = Array.isArray(body.imageUrls) ? body.imageUrls.map((v: unknown) => String(v).trim()).filter(Boolean).slice(0, 8) : [];

    const name = scraped?.name || manualName;
    const description = scraped?.description || manualDescription;
    const sourceCost = scraped?.sourceCost || (Number.isFinite(manualCost) && manualCost > 0 ? manualCost : 0);
    const images = scraped?.images?.length ? scraped.images : manualImages;
    const sourceCategoryName = scraped?.categoryName || '';

    const requestedCategoryId =
      typeof body.categoryId === 'string' && body.categoryId.trim()
        ? body.categoryId.trim()
        : '';

    let matchedCategory = requestedCategoryId
      ? await db.category.findUnique({ where: { id: requestedCategoryId }, select: { id: true, name: true } })
      : null;

    if (requestedCategoryId && !matchedCategory) {
      return NextResponse.json({ error: 'Selected category was not found.' }, { status: 400 });
    }

    if (!matchedCategory && sourceCategoryName) {
      const candidates = await db.category.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
      const normalizedSource = normalizeCategory(sourceCategoryName);
      matchedCategory =
        candidates.find(category => normalizeCategory(category.name) === normalizedSource) ||
        candidates.find(category => normalizeCategory(category.name).includes(normalizedSource) || normalizedSource.includes(normalizeCategory(category.name))) ||
        null;
    }

    if (!name) return NextResponse.json({ error: scrapeError || 'Product title could not be read. Enter the title manually.' }, { status: 422 });
    if (!sourceCost) return NextResponse.json({ error: scrapeError || 'Product price could not be read. Enter the current source price manually.' }, { status: 422 });

    const preview = {
      provider: parsedUrl.provider,
      externalId: parsedUrl.id,
      title: name,
      description,
      sourceCost,
      images,
      sourceCategoryName: sourceCategoryName || undefined,
      matchedCategoryId: matchedCategory?.id || '',
      matchedCategoryName: matchedCategory?.name || '',
      sourceUrl: parsedUrl.url,
      sellingPrice: sellingPrice(sourceCost, markup),
      markupPercent: markup,
      automatic: Boolean(scraped),
      scrapeWarning: scraped ? undefined : scrapeError,
    };

    if (action === 'preview') return NextResponse.json({ product: preview });

    if (!access.isSuperAdmin && !access.permissions.includes('pricing')) {
      return NextResponse.json({ error: 'Pricing permission required to import products.' }, { status: 403 });
    }

    const provider = parsedUrl.provider === 'AMAZON' ? 'AMAZON_MANUAL' : parsedUrl.provider === 'FLIPKART' ? 'FLIPKART_MANUAL' : 'MEESHO_URL_IMPORT';
    const integration = await db.marketplaceIntegration.upsert({
      where: { provider },
      update: { enabled: true, lastError: null },
      create: { provider, enabled: true, autoSync: false, healthStatus: 'MANUAL_IMPORT' },
    });

    const existing = await db.marketplaceProduct.findUnique({
      where: { integrationId_externalId: { integrationId: integration.id, externalId: parsedUrl.id } },
      select: { productId: true },
    });
    if (existing?.productId) return NextResponse.json({ error: 'This product is already imported into Zenvora.', productId: existing.productId }, { status: 409 });

    const baseSlug = slugify(name);
    let slug = baseSlug;
    for (let n = 2; ; n++) {
      const clash = await db.product.findUnique({ where: { slug }, select: { id: true } });
      if (!clash) break;
      slug = `${baseSlug}-${n}`;
    }

    const categoryId = matchedCategory?.id || null;

    const product = await db.product.create({
      data: {
        name,
        slug,
        description: description || null,
        sourceUrl: parsedUrl.url,
        sourceCost: new Prisma.Decimal(sourceCost),
        sellingPrice: new Prisma.Decimal(preview.sellingPrice),
        stock: 0,
        status: 'DRAFT',
        categoryId,
      },
    });

    let importedImages = 0;
    for (let i = 0; i < images.length; i++) {
      const imageUrl = await importImage(product.id, images[i], i);
      if (!imageUrl) continue;
      await db.productImage.create({ data: { productId: product.id, url: imageUrl, altText: name, sortOrder: importedImages } });
      importedImages++;
    }

    await db.marketplaceProduct.create({
      data: {
        integrationId: integration.id,
        externalId: parsedUrl.id,
        productId: product.id,
        title: name,
        sourceUrl: parsedUrl.url,
        rawData: { provider: parsedUrl.provider, sourceCost, markupPercent: markup, imageCount: importedImages, automatic: Boolean(scraped), availability: scraped?.availability || 'UNKNOWN' },
        lastSourceCost: new Prisma.Decimal(sourceCost),
        sourceAvailability: scraped?.availability || 'UNKNOWN',
      },
    });

    await db.marketplaceIntegration.update({
      where: { id: integration.id },
      data: { importedProducts: { increment: 1 }, lastSuccessAt: new Date(), lastSyncAt: new Date(), healthStatus: 'HEALTHY', lastError: null },
    });

    await db.marketplaceImportLog.create({
      data: {
        integrationId: integration.id,
        productId: product.id,
        externalId: parsedUrl.id,
        sourceUrl: parsedUrl.url,
        title: name,
        status: 'SUCCESS',
        automatic: Boolean(scraped),
        sourceCost: new Prisma.Decimal(sourceCost),
        sellingPrice: new Prisma.Decimal(preview.sellingPrice),
        importedImages,
      },
    });

    return NextResponse.json({
      ok: true,
      productId: product.id,
      importedImages,
      sellingPrice: preview.sellingPrice,
      automatic: Boolean(scraped),
      categoryId,
      categoryName: matchedCategory?.name || null,
      sourceCategoryName: sourceCategoryName || null,
      categoryMatched: Boolean(matchedCategory),
    });
  } catch (error) {
    console.error('Marketplace product import failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Marketplace import failed.' }, { status: 500 });
  }
}
