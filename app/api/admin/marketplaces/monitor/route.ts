import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAdminAccess } from '../../../../../lib/admin-access';
import { db } from '../../../../../lib/db';
import { scrapeMarketplaceProduct } from '../../../../../lib/marketplace-scraper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const admin = await getAdminAccess();
  if (!admin || (!admin.isSuperAdmin && !admin.permissions.includes('marketplaces'))) {
    return NextResponse.json({ error: 'Marketplace permission required.' }, { status: 403 });
  }

  const products = await db.marketplaceProduct.findMany({
    where: {
      sourceUrl: { not: null },
      integration: { provider: { in: ['AMAZON_MANUAL', 'FLIPKART_MANUAL', 'MEESHO_URL_IMPORT'] } },
    },
    include: { integration: { select: { provider: true } } },
    orderBy: { lastCheckedAt: 'asc' },
    take: 25,
  });

  const results: Array<Record<string, unknown>> = [];
  for (const item of products) {
    if (!item.sourceUrl) continue;
    try {
      const scraped = await scrapeMarketplaceProduct(item.sourceUrl);
      const previousCost = item.lastSourceCost;
      const currentCost = new Prisma.Decimal(scraped.sourceCost);

      await db.$transaction(async tx => {
        if (previousCost && !previousCost.eq(currentCost)) {
          await tx.marketplacePriceChange.create({
            data: {
              marketplaceProductId: item.id,
              previousCost,
              currentCost,
            },
          });
        }

        await tx.marketplaceProduct.update({
          where: { id: item.id },
          data: {
            lastSourceCost: currentCost,
            sourceAvailability: scraped.availability,
            lastCheckedAt: new Date(),
            lastCheckError: null,

          },
        });

        if (item.productId && scraped.availability === 'UNAVAILABLE') {
          await tx.product.updateMany({
            where: { id: item.productId, status: 'ACTIVE' },
            data: { status: 'OUT_OF_STOCK' },
          });
        }
      });

      results.push({
        externalId: item.externalId,
        status: 'SUCCESS',
        availability: scraped.availability,
        sourceCost: scraped.sourceCost,
        priceChanged: Boolean(previousCost && !previousCost.eq(currentCost)),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Source check failed.';
      await db.marketplaceProduct.update({
        where: { id: item.id },
        data: { lastCheckedAt: new Date(), lastCheckError: message, sourceAvailability: 'UNKNOWN' },
      });
      results.push({ externalId: item.externalId, status: 'FAILED', error: message });
    }
  }

  return NextResponse.json({ checked: results.length, results });
}
