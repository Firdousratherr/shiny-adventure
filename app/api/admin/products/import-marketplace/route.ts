import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { put } from '@vercel/blob';
import { getAdminAccess } from '@/lib/admin-access';
import { db } from '@/lib/db';
import { parseMarketplaceSourceUrl, scrapeMarketplaceProduct } from '@/lib/marketplace-scraper';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'imported-product';
}

function sellingPrice(cost: number, markup: number) {
  return Math.round(cost * (1 + markup / 100) * 100) / 100;
}

function normalizeCategory(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

async function importImage(productId: string, imageUrl: string, index: number, referer: string) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(imageUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36',
          Accept: 'image/avif,image/webp,image/jpeg,image/png,*/*',
          'Accept-Language': 'en-IN,en;q=0.9',
          Referer: referer || 'https://www.meesho.com/',
        },
        cache: 'no-store',
      });
      if (!response.ok || !response.body) return null;

      const type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      const extension = type === 'image/png'
        ? 'png'
        : type === 'image/webp'
          ? 'webp'
          : type === 'image/jpeg'
            ? 'jpg'
            : type === 'image/gif'
              ? 'gif'
              : type === 'image/avif'
                ? 'avif'
                : null;
      if (!extension) return null;

      const buffer = await response.arrayBuffer();
      if (!buffer.byteLength || buffer.byteLength > 5 * 1024 * 1024) return null;

      const bytes = new Uint8Array(buffer);
      const valid =
        (type === 'image/jpeg' && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
        (type === 'image/png' && bytes.length >= 8 && bytes.slice(0, 8).every((b, i) => b === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][i])) ||
        (type === 'image/webp' && bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') ||
        (type === 'image/gif' && bytes.length >= 6 && new TextDecoder().decode(bytes.slice(0, 6)) === 'GIF89a') ||
        (type === 'image/avif' && bytes.length >= 12);
      if (!valid) return null;

      const blob = await put(
        `products/${productId}/marketplace-${index}-${crypto.randomUUID()}.${extension}`,
        new Blob([buffer], { type }),
        { access: 'private', addRandomSuffix: false },
      );
      return blob.url;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}
export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (!access || (!access.isSuperAdmin && (!access.permissions.includes('products') || !access.permissions.includes('marketplaces')))) {
    return NextResponse.json({ error: 'Marketplace import permission required.' }, { status: 403 });
  }

  const limited = await rateLimit(`marketplace-direct-import:${access.id}`, 6, 60);
  if (limited.limited) {
    return NextResponse.json(
      { error: 'Too many direct imports. Please wait a minute before trying again.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
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
    const productId = crypto.randomUUID();

    // Create the inventory product and its marketplace identity atomically.
    // This closes the race where two admins import the same source at once and
    // leaves an orphan product behind when the marketplace unique key collides.
    let product: { id: string; name: string; sellingPrice: Prisma.Decimal; sourceCost: Prisma.Decimal | null };
    try {
      product = await db.$transaction(async tx => {
        const created = await tx.product.create({
          data: {
            id: productId,
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
          select: { id: true, name: true, sellingPrice: true, sourceCost: true },
        });

        await tx.marketplaceProduct.create({
          data: {
            integrationId: integration.id,
            externalId: parsedUrl.id,
            productId: created.id,
            title: name,
            sourceUrl: parsedUrl.url,
            rawData: {
              provider: parsedUrl.provider,
              sourceCost,
              markupPercent: markup,
              imageCount: 0,
              automatic: Boolean(scraped),
              availability: scraped?.availability || 'UNKNOWN',
            },
            lastSourceCost: new Prisma.Decimal(sourceCost),
            sourceAvailability: scraped?.availability || 'UNKNOWN',
          },
        });

        await tx.marketplaceIntegration.update({
          where: { id: integration.id },
          data: {
            importedProducts: { increment: 1 },
            lastSuccessAt: new Date(),
            lastSyncAt: new Date(),
            healthStatus: 'HEALTHY',
            lastError: null,
          },
        });

        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : String(error.meta?.target ?? '');
        if (target.includes('integrationId') && target.includes('externalId')) {
          const duplicate = await db.marketplaceProduct.findUnique({
            where: { integrationId_externalId: { integrationId: integration.id, externalId: parsedUrl.id } },
            select: { productId: true },
          });
          return NextResponse.json(
            { error: 'This product is already imported into Zenvora.', productId: duplicate?.productId || undefined },
            { status: 409 },
          );
        }
      }
      throw error;
    }

    let importedImages = 0;
    for (let i = 0; i < images.length; i++) {
      const imageUrl = await importImage(product.id, images[i], i, parsedUrl.url);
      const finalUrl = imageUrl || images[i];
      if (!finalUrl) continue;
      await db.productImage.create({ data: { productId: product.id, url: finalUrl, altText: name, sortOrder: importedImages } });
      importedImages++;
    }

    await db.marketplaceProduct.update({
      where: { integrationId_externalId: { integrationId: integration.id, externalId: parsedUrl.id } },
      data: {
        rawData: {
          provider: parsedUrl.provider,
          sourceCost,
          markupPercent: markup,
          imageCount: importedImages,
          automatic: Boolean(scraped),
          availability: scraped?.availability || 'UNKNOWN',
        },
        sourceAvailability: scraped?.availability || 'UNKNOWN',
      },
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
